const Web3 = require('web3');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const cron = require('node-cron');
//load env file
require('dotenv').config()

// Replace the following with your Ethereum node URL
const nodeUrl = process.env.ORIGIN_HTTPS_ENDPOINT;
const addressToCheck = process.env.ADDRESS_TO_CHECK;
const usdtContractAddress = process.env.USDT_TOKEN_CONTRACT_ADDRESS;

async function getMemo(web3, tx) {
  // Check if the transaction data field is not empty
  if (tx.input !== '0x') {
    try {
      // The data field of USDT transfers follows a specific format.
      // The first 4 bytes represent the method signature, and the next 32 bytes represent the recipient's address.
      // The next 32 bytes represent the amount, and the last 32 bytes represent the memo.

      // Method signature for transfer is "0xa9059cbb"
      const methodSignature = '0xa9059cbb';

      // Get the recipient address (next 32 bytes after the method signature)
      // const recipientAddress = '0x' + tx.input.slice(10, 74);

      // Get the amount (next 32 bytes after the recipient address)
      //  const amount = web3.utils.hexToNumberString('0x' + tx.input.slice(74, 138));

      // Get the memo (last 32 bytes)
      const memo = web3.utils.hexToAscii('0x' + tx.input.slice(138));


      return `${memo}`;

    } catch (error) {
      console.error('Error decoding transaction data:', error.message);
    }
  }
  return ''; // Return empty memo if data field is empty
}

async function getBlockNumbersForDayWeekMonthYear(currentBlockNumber) {

  const oneDayBlocks = 28800; // Assuming ~3 seconds per block on average (can be adjusted)
  const oneWeekBlocks = oneDayBlocks * 7;
  const oneMonthBlocks = oneDayBlocks * 30; // Assuming ~30 days in a month (can be adjusted for accuracy)
  const oneYearBlocks = oneDayBlocks * 365; // Assuming ~365 days in a year (can be adjusted for accuracy)

  const dayAgoBlock = currentBlockNumber - oneDayBlocks;
  const weekAgoBlock = currentBlockNumber - oneWeekBlocks;
  const monthAgoBlock = currentBlockNumber - oneMonthBlocks;
  const yearAgoBlock = currentBlockNumber - oneYearBlocks;

  return {
    day: dayAgoBlock,
    week: weekAgoBlock,
    month: monthAgoBlock,
    year: yearAgoBlock,
  };
}




async function getTransactionTimestamp(web3, tx) {
  try {
    const block = await web3.eth.getBlock(tx.blockNumber);
    return block.timestamp;
  } catch (error) {
    console.error('Error fetching block timestamp:', error.message);
    return null;
  }
}

async function getUSDTTransferEvents(dayblocks,currentBlockNumber) {
  const web3 = new Web3(nodeUrl);

  // Define the USDT contract ABI
  const usdtContractAbi = [
    // USDT Transfer event
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "from",
          "type": "address"
        },
        {
          "indexed": true,
          "name": "to",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "Transfer",
      "type": "event"
    }
  ];

  // Create a contract instance
  const usdtContract = new web3.eth.Contract(usdtContractAbi, usdtContractAddress);


  const getPreviousBlock = currentBlockNumber - 1; // can be used to get all transactions per block 


  // Block range variables
  const batchSize = 10000;
  let fromBlock = dayblocks; // startBlock; >> for first transaction tracked block > 32533130   dayblocks >> currentBlock - 1 day of blocks
  let toBlock = fromBlock + batchSize;

  // Array to store transactions
  let transactions = [];

  while (toBlock <= currentBlockNumber) {
    try {
      // Get all Transfer events in the current batch range
      const events = await usdtContract.getPastEvents('Transfer', {
        filter: { from: addressToCheck },
        fromBlock,
        toBlock
      });

      // Loop through events and create transactions array
      for (const event of events) {
        const { transactionHash, returnValues } = event;

        try {
          // Get the transaction details using the transaction hash
          const tx = await web3.eth.getTransaction(transactionHash);

          // Skip transactions with invalid timestamps or pending transactions
          const blockTimestamp = await getTransactionTimestamp(web3, tx);

          if (!blockTimestamp) {
            console.warn('Skipping transaction with invalid timestamp:', transactionHash);
            continue;
          }

          const memo = await getMemo(web3, tx);
          if (!memo) {
            console.warn('Skipping transaction with no memo:', transactionHash);
            continue;
          }

          // Skip transactions with zero amount
          const amount = web3.utils.fromWei(returnValues.value, 'mwei');
          if (parseFloat(amount) === 0) {
            console.warn('Skipping transaction with zero amount:', transactionHash);
            continue;
          }

          console.log("MEMO: " + memo);
          console.log("TransactionHash: " + transactionHash);


          transactions.push({
            Date: new Date(blockTimestamp * 1000).toISOString(),
            TxHash: transactionHash,
            // 'From Address': returnValues.from,
            Destination: returnValues.to,
            Amount: web3.utils.fromWei(returnValues.value, 'mwei'),
            Memo: memo,
          });
        } catch (error) {
          console.error('Error fetching transaction:', error.message);
        }
      }
      // Update block range for the next batch
      fromBlock = toBlock + 1;
      toBlock = fromBlock + batchSize;

    } catch (error) {
      console.error('Error fetching logs:', error.message);
    }
  }

  return transactions;
}


async function exportToCSV(transactions, filename) {
  const csvWriter = createCsvWriter({
    path: filename,
    header: [
      { id: 'Date', title: 'Date' },
      { id: 'TxHash', title: 'TxHash' },
      { id: 'Destination', title: 'Destination' },
      { id: 'Amount', title: 'Amount' },
      { id: 'Memo', title: 'Memo' },
    ],
  });

  await csvWriter.writeRecords(transactions);
  console.log(`CSV file ${filename} has been created successfully.`);
}

async function main() {
  try {
    const web3 = new Web3(nodeUrl);
    const currentBlockNumber = await web3.eth.getBlockNumber();
    const blockNumbers = await getBlockNumbersForDayWeekMonthYear(currentBlockNumber);
    const transactions = await getUSDTTransferEvents(blockNumbers.day, currentBlockNumber);
    
    const currentDate = new Date().toISOString().slice(0, 10);
    const filename = `transactions_${currentDate}.csv`;

    await exportToCSV(transactions, filename);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

console.log("starting script");
console.log('Running the task at 05:00AM UTC every day.');
// Schedule the task to run every day at 05:00
cron.schedule('0 5 * * *', async () => {
  const currentDate = new Date().toLocaleString(); 
  console.log(`[${currentDate}] executing main function..`); 
  await main();
}, {
  scheduled: true,
  timezone: 'UTC'
});
