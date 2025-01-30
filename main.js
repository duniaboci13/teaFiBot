import axios from "axios";
import sendDepositTransaction from './utils/swap.js';
import { formatUnits } from "ethers";
import log from './utils/logger.js'
import banner from './utils/banner.js'

const TOKEN_ADDRESS = {
    POL: "0x0000000000000000000000000000000000000000",
    WPOL: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
    NETWORK_ID: 137,
    TYPE: 2 // Convert
};

async function getGasQuote() {
    try {
        const url = "https://api.tea-fi.com/transaction/gas-quote";
        const params = {
            chain: TOKEN_ADDRESS.NETWORK_ID,
            txType: TOKEN_ADDRESS.TYPE,
            gasPaymentToken: TOKEN_ADDRESS.POL,
            neededGasPermits: 0
        };

        const response = await axios.get(url, { params });
        const gasInNativeToken = response?.data?.gasInNativeToken || '0'

        log.info("⛽ Gas In Native Token:", `${formatUnits(gasInNativeToken, 18)} POL`);
        return gasInNativeToken;
    } catch (error) {
        log.error("❌ Error fetching gas:", error.response ? error.response.data : error.message);
        return '0';
    }
}

function getTokenSymbol(address) {
    return Object.keys(TOKEN_ADDRESS).find(key => TOKEN_ADDRESS[key] === address) || "UNKNOWN";
}

async function sendTransaction(gasFee, retries = 5) {
    const { txHash, address, amount } = await sendDepositTransaction();
    if (!txHash) return;

    const fromTokenSymbol = getTokenSymbol(TOKEN_ADDRESS.POL);
    const toTokenSymbol = getTokenSymbol(TOKEN_ADDRESS.WPOL);

    const payload = {
        hash: txHash,
        blockchainId: TOKEN_ADDRESS.NETWORK_ID,
        type: TOKEN_ADDRESS.TYPE,
        walletAddress: address,
        fromTokenAddress: TOKEN_ADDRESS.POL,
        toTokenAddress: TOKEN_ADDRESS.WPOL,
        fromTokenSymbol,
        toTokenSymbol,
        fromAmount: amount,
        toAmount: amount,
        gasFeeTokenAddress: TOKEN_ADDRESS.POL,
        gasFeeTokenSymbol: fromTokenSymbol,
        gasFeeAmount: gasFee
    };

    try {
        const response = await axios.post("https://api.tea-fi.com/transaction", payload);
        log.info("✅ Transaction Report Sent To Backend:", response?.data);

        await getPoints(address)
        return response?.data;
    } catch (error) {
        log.error("❌ Failed To Send Transaction Report:", error.response?.data || error.message);

        if (retries > 0) {
            log.warn(`🔃 Retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            return await sendTransaction(gasFee, retries - 1);
        } else {
            log.error("🚨 Max retries reached. Giving up.");
            return null;
        }
    }
}

async function getPoints(address) {
    log.info(`🔃 Trying to check current points...`)
    try {
        const response = await axios.get(`https://api.tea-fi.com/points/${address}`);
        log.info("📊 Total Points:", response?.data?.pointsAmount || 0);
    } catch (error) {
        log.error("❌ Error When Checking Points:", error.response?.data || error.message);
    }
}

(async () => {
    console.log(banner)
    await new Promise(resolve => setTimeout(resolve, 5 * 1000));
    let counter = 0;

    while (true) {
        console.clear()
        counter++;
        log.info(`=X= ================ZLKCYBER================ =X=`)
        log.info(`🔃 Processing Transaction ${counter} ( CTRL + C ) to exit..\n`)
        const gasFee = await getGasQuote()
        await sendTransaction(gasFee);

        log.info(`=X= ======================================== =X=`)
        await new Promise(resolve => setTimeout(resolve, 10 * 1000));
    }
})();
