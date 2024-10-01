// 检查并加载 ethers 库
function loadEthers() {
    return new Promise((resolve, reject) => {
        const statusElement = document.getElementById('ethers-status');
        
        if (typeof ethers !== 'undefined') {
            statusElement.textContent = 'Ethers library is already loaded.';
            statusElement.className = 'mt-4 text-center text-sm text-green-600';
            resolve();
        } else {
            statusElement.textContent = 'Loading Ethers library...';
            statusElement.className = 'mt-4 text-center text-sm text-yellow-600';
            
            const script = document.createElement('script');
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/ethers/5.2.0/ethers.umd.min.js";
            script.onload = () => {
                statusElement.textContent = 'Ethers library loaded successfully.';
                statusElement.className = 'mt-4 text-center text-sm text-green-600';
                resolve();
            };
            script.onerror = () => {
                statusElement.textContent = 'Failed to load Ethers library. Some features may not work.';
                statusElement.className = 'mt-4 text-center text-sm text-red-600';
                reject(new Error('Failed to load Ethers library'));
            };
            document.body.appendChild(script);
        }
    });
}

const emcTestnetConfig = {
    chainId: '0x18624', // 99876 in hexadecimal
    chainName: 'EMC Testnet',
    nativeCurrency: {
        name: 'EMC',
        symbol: 'EMC',
        decimals: 18
    },
    rpcUrls: [
        'https://rpc1-testnet.emc.network',
        'https://rpc2-testnet.emc.network',
        'wss://rpc3-testnet.emc.network',
        'wss://rpc4-testnet.emc.network'
    ],
    blockExplorerUrls: ['https://testnet.emcscan.com/']
};

let isConnected = false;
let currentAccount = null;
let provider, signer;

function truncateAddress(address) {
    return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';
}

function updateUI() {
    const connectButton = document.getElementById('connect-button');
    const payWifiButton = document.getElementById('pay-wifi-button');
    const statusElement = document.getElementById('wallet-status');

    if (isConnected && currentAccount) {
        connectButton.textContent = 'Disconnect from EMC Testnet';
        statusElement.textContent = `Connected to EMC Testnet: ${truncateAddress(currentAccount)}`;
        statusElement.classList.add('text-green-600');
        payWifiButton.classList.remove('hidden');
    } else {
        connectButton.textContent = 'Connect to EMC Testnet';
        statusElement.textContent = 'Not connected';
        statusElement.classList.remove('text-green-600');
        payWifiButton.classList.add('hidden');
    }
}

async function checkConnection() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            
            isConnected = accounts.length > 0 && chainId === emcTestnetConfig.chainId;
            currentAccount = isConnected ? accounts[0] : null;
            
            if (isConnected) {
                provider = new ethers.providers.Web3Provider(window.ethereum);
                signer = provider.getSigner();
            }
        } catch (error) {
            console.error('Failed to get accounts or chain:', error);
            isConnected = false;
            currentAccount = null;
        }
    } else {
        isConnected = false;
        currentAccount = null;
    }
    updateUI();
}

async function toggleConnection() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            if (!isConnected) {
                // Switch to EMC Testnet
                try {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: emcTestnetConfig.chainId }],
                    });
                } catch (switchError) {
                    // This error code indicates that the chain has not been added to MetaMask.
                    if (switchError.code === 4902) {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [emcTestnetConfig],
                        });
                    } else {
                        throw switchError;
                    }
                }

                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                isConnected = true;
                currentAccount = accounts[0];
                provider = new ethers.providers.Web3Provider(window.ethereum);
                signer = provider.getSigner();
                console.log('Wallet connected to EMC Testnet:', currentAccount);
            } else {
                isConnected = false;
                currentAccount = null;
                provider = null;
                signer = null;
                console.log('Wallet disconnected from EMC Testnet');
            }
            updateUI();
        } catch (error) {
            console.error('Failed to toggle wallet connection:', error);
            alert(`Failed to ${isConnected ? 'disconnect from' : 'connect to'} EMC Testnet: ${error.message}`);
        }
    } else {
        alert('Please install MetaMask!');
    }
}

const EMC_TOKEN_ADDRESS = '0x6B47472A68f3a166EA68d0A0464660CAf43A5B5D'; 
async function payForWifi() {
    if (!isConnected || !signer) {
        alert('Please connect your wallet to EMC Testnet first');
        return;
    }

    const receiverAddress = '0xc699b5015B836bf65c83222126B4f1F012226974';
    const amount = ethers.utils.parseEther('0.001');

    try {
        document.getElementById('payment-status').textContent = 'Preparing transaction...';

        // 检查余额
        const balance = await signer.getBalance();
        console.log('Current balance:', ethers.utils.formatEther(balance), 'EMC');

        if (balance.lt(amount)) {
            throw new Error('Insufficient balance');
        }

        // 获取当前 nonce
        const nonce = await signer.getTransactionCount();

        // 获取当前 gas 价格
        const gasPrice = await provider.getGasPrice();
        console.log('Current gas price:', ethers.utils.formatUnits(gasPrice, 'gwei'), 'gwei');

        // 估算 gas 限制
        const estimatedGas = await signer.estimateGas({
            to: receiverAddress,
            value: amount
        });
        console.log('Estimated gas:', estimatedGas.toString());

        // 增加 gas 限制和价格
        const gasLimit = estimatedGas.mul(15).div(10); // 增加 50%
        const adjustedGasPrice = gasPrice.mul(12).div(10); // 增加 20%

        document.getElementById('payment-status').textContent = 'Sending transaction...';

        const tx = await signer.sendTransaction({
            to: receiverAddress,
            value: amount,
            gasLimit: gasLimit,
            gasPrice: adjustedGasPrice,
            nonce: nonce
        });

        document.getElementById('payment-status').textContent = 'Transaction sent. Waiting for confirmation...';

        const receipt = await tx.wait();

        document.getElementById('payment-status').textContent = 'Payment successful.';
        console.log('Transaction confirmed:', receipt.transactionHash);

        // 弹出成功提示窗口
        alert('Payment successful! You can now freely access the internet.');

    } catch (error) {
        console.error('Payment failed:', error);
        let errorMessage = 'Payment failed: ';

        if (error.message.includes('insufficient funds')) {
            errorMessage += 'Insufficient balance for transaction.';
        } else if (error.message.includes('execution reverted')) {
            errorMessage += 'Transaction was reverted. Please try again or contact support.';
        } else {
            errorMessage += error.message;
        }

        document.getElementById('payment-status').textContent = errorMessage;
        alert(errorMessage);
    }
}

loadEthers().then(() => {
    if (typeof window.ethereum !== 'undefined') {
        window.ethereum.on('accountsChanged', (accounts) => {
            checkConnection();
        });

        window.ethereum.on('chainChanged', () => {
            checkConnection();
        });
    }

    checkConnection();

    document.getElementById('connect-button').addEventListener('click', toggleConnection);
    document.getElementById('pay-wifi-button').addEventListener('click', payForWifi);
}).catch(error => {
    console.error('Failed to initialize:', error);
    document.getElementById('ethers-status').textContent = 'Failed to initialize. Please refresh the page and try again.';
    document.getElementById('ethers-status').className = 'mt-4 text-center text-sm text-red-600';
});