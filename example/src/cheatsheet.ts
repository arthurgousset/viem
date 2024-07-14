/**
 * Credit to @apeview.
 * Source: https://medium.com/@apeview/typescript-and-viem-quickstart-for-blockchain-scripting-3f1846970b6f
 * Source: https://github.com/apeview/node-ts-viem-quickstart
 */
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  formatUnits,
  getContract,
  http,
  parseAbi,
  parseEther,
  parseUnits,
} from "viem";
import { celoAlfajores } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import "dotenv/config";

async function main() {
  // 1. create public (read) and wallet (write) client with default rpc
  const read = createPublicClient({
    chain: celoAlfajores,
    transport: http(),
    batch: { multicall: true },
  });
  const write = createWalletClient({ chain: celoAlfajores, transport: http() });

  // or with custom rpc
  // const rpc = 'https://rpc.ankr.com/eth';
  // const read = createPublicClient({ chain: celoAlfajores, transport: http(rpc), batch: { multicall: true } });
  // const write = createWalletClient({ chain: celoAlfajores, transport: http(rpc) });

  // 2.1 basic: read block, check rpc out of sync
  const block = await read.getBlock();
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now - block.timestamp > 30) throw Error("rpc out of sync");

  // 2.2 basic: read ether balance
  const address = "0x303C22e6ef01CbA9d03259248863836CB91336D5";
  const balance = await read.getBalance({ address });
  console.log(`balance: ${formatEther(balance)}`);

  // 2.3 basic: send ether
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const account = privateKeyToAccount(`0x${PRIVATE_KEY}`);
  const hash = await write.sendTransaction({
    account,
    to: "0x8E3DC120aa9e34cA55b572324AB8Ef73ca211092",
    value: parseEther("0.5"),
  });
  console.log(`send ether tx: ${hash}`);

  // 3.1 contract: abi
  const abi = parseAbi([
    "function name() public view returns (string memory)",
    "function symbol() view returns (string memory)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address account) public view returns (uint256)",
    "function transfer(address to, uint256 value) public returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
  ]);

  // 3.1 contract: get instance
  const contract = getContract({
    address: "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1", // cUSD
    abi,
    client: { public: read, wallet: write },
  });

  // 3.2 contract: single query
  const name = await contract.read.name();
  console.log(`token name: ${name}`);

  // 3.2 contract: batch queries
  const [symbol, decimals, tokenBalance] = await Promise.all([
    contract.read.symbol(),
    contract.read.decimals(),
    contract.read.balanceOf(["0xcEe284F754E854890e311e3280b767F80797180d"]),
  ]);
  console.log(`${symbol} balance of ${address}: ${formatUnits(tokenBalance, decimals)}`);

  // 3.3 contract: write
  const to = "0x8E3DC120aa9e34cA55b572324AB8Ef73ca211092";
  const tx = await contract.write.transfer([to, parseUnits("0.5", decimals)], { account });
  console.log(`transfer erc20 tx: ${tx}`);

  // 3.4 contract: read event
  contract.watchEvent.Transfer({}, { onLogs: (logs) => console.log(logs) });

  await new Promise(function () {});
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
