import { ethers } from "ethers";
import log from './logger.js'
import dotenv from "dotenv";
import ora from 'ora'
dotenv.config();

// Constants
const CONTRACT_ADDRESS = "0x1E438D4414f38CD2bEB71B73721181CDe019f708";
const RPC_URL = "https://polygon-rpc.com";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const MIN = 0.00001;
const MAX = 0.001000;

// ABI 
const ABI = [
    "function deposit() external payable"
];

async function sendDepositTransaction() {
    if (!PRIVATE_KEY) {
        log.error("❌ PRIVATE_KEY is missing. Set it in a .env file.");
        return;
    }

    let spinner;
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

    try {
        const randomAmount = (Math.random() * (MAX - MIN) + MIN).toFixed(8);
        const amountToSend = ethers.parseEther(randomAmount.toString());

        log.info(`🔹 Wrapping ${randomAmount} USDT to tUSDT...`);
        const feeData = await provider.getFeeData();

        const gasPrice = feeData.gasPrice ? feeData.gasPrice * 125n / 100n : undefined; // increase gwei 25% for fast transaction

        const tx = await contract.deposit({
            value: amountToSend,
            gasPrice,
        });

        log.info(`📜 Transaction Sent at hash: ${tx.hash}`);
        spinner = ora(' Waiting for confirmation...').start();

        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Transaction confirmation timeout")), 90 * 1000)
        );

        const receipt = await Promise.race([tx.wait(), timeout]);
        spinner.succeed(` Transaction confirmed in block: ${receipt.blockNumber}`);
        return { txHash: tx.hash, address: wallet.address, amount: amountToSend.toString() };
    } catch (error) {
        if (spinner) {
            spinner.fail(` Transaction failed: ${error.message}`);
        } else {
            log.error("❌ Error sending transaction:", error.message);
        }

        return { txHash: null, address: wallet.address, amount: null };
    }
}

export default sendDepositTransaction;
