# USDT Transfer Events Tracker

This Node.js script tracks USDT (Tether) transfer events on the Ethereum blockchain and exports the transaction data to a CSV file. You can schedule the script to run daily using `node-cron`.

## Prerequisites

- Node.js installed on your machine
- Ethereum node URL configured in a `.env` file
- Environment variables set up in `.env` file (refer to `.env.example`)

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/wallaceSip/tx-CSV.git

2.**Navigate to the Project Repository**

3. **Install Dependencies**
   ```bash
    npm install


4. **Set Up Environment Variables**:

- Create a .env file in the project root.
- Add the following environment variables:
   ```bash
    ORIGIN_HTTPS_ENDPOINT=<Your Ethereum Node URL>
    ADDRESS_TO_CHECK=<Address to track>
    USDT_TOKEN_CONTRACT_ADDRESS=<USDT Token Contract Address>


## Execution

### Run Manually

To run the script manually, execute the following command:

\`\`\`bash
node csvCreator.js   // get all the transactions from a address
\`\`\`

Replace \`csvCreator.js\` with the name of your main script file , if you changed the default name.

### Schedule with \`node-cron\`

You can schedule the script to run automatically every day at 05:00 AM UTC using \`node-cron\`. Ensure you have the \`cron.schedule\` function set up in your script to automate this.

\`\`\`javascript
// Schedule the task to run every day at 05:00
cron.schedule('0 5 * * *', async () => {
  console.log('Running the task at 05:00AM every day.');
  await main();
}, {
  scheduled: true,
  timezone: 'UTC'
});
\`\`\`
