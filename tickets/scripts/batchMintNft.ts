import { toNano, beginCell, Dictionary, Address, Cell } from '@ton/core';
import { NftCollection } from '../wrappers/NftCollection';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const [collectionAddress, count] = args;
    
    if (!collectionAddress || !count) {
        console.log('Usage: blueprint run batchMintNft <collection_address> <count>');
        return;
    }

    const collection = provider.open(NftCollection.createFromAddress(Address.parse(collectionAddress)));
    
    const deployList = Dictionary.empty(Dictionary.Keys.Uint(64), {
        serialize: (src: { amount: bigint, content: Cell }) => {
            return beginCell()
                .storeCoins(src.amount)
                .storeRef(src.content)
                .endCell();
        },
        parse: (src) => {
            return {
                amount: src.loadCoins(),
                content: src.loadRef()
            };
        }
    });

    const numNfts = parseInt(count);
    for (let i = 0; i < numNfts; i++) {
        deployList.set(i, {
            amount: toNano('0.1'),
            content: beginCell()
                .storeAddress(provider.sender().address)
                .storeRef(beginCell().storeBuffer(Buffer.from(i.toString())).endCell())
                .endCell()
        });
    }

    await collection.sendBatchMintNft(provider.sender(), {
        value: toNano((0.2 * numNfts).toString()),
        deployList,
    });

    console.log(`${numNfts} NFTs minted successfully`);
}