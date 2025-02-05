import axios from "axios";
import sendDepositTransaction from './utils/swap.js';
import { formatUnits } from "ethers";
import log from './utils/logger.js'
import banner from './utils/banner.js'

const TOKEN_ADDRESS = {
    USDT: "0x0000000000000000000000000000000000000000",
    POL: "0x0000000000000000000000000000000000000000",
    tUSDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
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

async function sendTransaction(
    gasFee,
    isRetry = false,
    retries = 5,
    txHash,
    address,
    amount) {
    if (!isRetry) {
        try {
            ({ txHash, address, amount } = await sendDepositTransaction());
            if (!txHash) throw new Error("Transaction hash is undefined.");
        } catch (error) {
            log.error("❌ Failed to initiate transaction:", error.message);
            return null;
        }
    }

    log.info(`🚀 Trying to send tx report to backend:`, txHash)

    const fromTokenSymbol = getTokenSymbol(TOKEN_ADDRESS.USDT);
    const toTokenSymbol = getTokenSymbol(TOKEN_ADDRESS.tUSDT);

    const payload = {
        hash: txHash,
        blockchainId: TOKEN_ADDRESS.NETWORK_ID,
        type: TOKEN_ADDRESS.TYPE,
        walletAddress: address,
        fromTokenAddress: TOKEN_ADDRESS.USDT,
        toTokenAddress: TOKEN_ADDRESS.tUSDT,
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
        log.info("✅ Transaction Report Succesfully Sent:", response?.data);

        await getPoints(address);
        return address;
    } catch (error) {
        log.error("❌ Failed To Send Transaction Report:", error.response?.data || error.message);

        if (retries > 0) {
            log.warn(`🔃 Retrying in 3s... (${retries - 1} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            return sendTransaction(
                gasFee,
                true,
                retries - 1,
                txHash,
                address,
                amount
            );
        }

        log.error("🚨 Max retries reached. Giving up or ask them to upgrade server lol😆");
        return address;
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

async function checkInStatus(address) {
    try {
        const response = await axios.get(`https://api.tea-fi.com/wallet/check-in/current?address=${address}`);
        log.info("📅 Last CheckIn:", response?.data?.lastCheckIn || `Never check in`);
        return response?.data?.lastCheckIn
    } catch (error) {
        log.error("❌ Failed to Check latest checkIn:", error.response?.data || error.message);
    }
}

async function checkIn(address) {
    try {
        const response = await axios.post(`https://api.tea-fi.com/wallet/check-in?address=${address}`, {});
        log.info("✅ Check-In Succesfully:", response.data);
    } catch (error) {
        log.error("❌ Failed to Check-In:", error.response?.data || error.message);
    }
}

async function checkInUser(address) {
    log.info(`📢 Trying to check latest checkin user...`)
    const lastCheckIn = await checkInStatus(address);
    const lastDate = new Date(lastCheckIn).getUTCDate();
    const now = new Date().getUTCDate();
    if (lastDate !== now) {
        log.info(`🔃 Trying to checkin...`)
        await checkIn(address);
    } else {
        log.info(`✅ Already checkin today...`)
    }
}

(async () => {
    log.info(banner)
    await new Promise(resolve => setTimeout(resolve, 5 * 1000));
    let counter = 0;

    while (true) {
        console.clear()
        counter++;
        log.info(`=X= ================ZLKCYBER================ =X=`)
        log.info(`🔃 Processing Transaction ${counter} ( CTRL + C ) to exit..\n`)

        const gasFee = await getGasQuote()
        const address = await sendTransaction(gasFee);

        await checkInUser(address)
        log.info(`=X= ======================================== =X=`)
        await new Promise(resolve => setTimeout(resolve, 10 * 1000));
    }
})();
