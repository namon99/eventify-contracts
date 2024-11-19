import { toNano, beginCell, Address } from '@ton/core';
import { NftCollection } from '../wrappers/NftCollection';
import { compile, NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const [collectionAddress] = args;
    const itemContent = "/bootcamp_item.json";
    
    if (!collectionAddress) {
        console.log('Usage: blueprint run mintNft <collection_address>');
        return;
    }

    const collection = provider.open(NftCollection.createFromAddress(Address.parse(collectionAddress)));

    // Get next item index from collection
    const collectionData = await collection.getCollectionData();
    const nextItemIndex = collectionData.nextItemIndex;
    const itemAddress = await collection.getNftAddressByIndex(nextItemIndex);

    const result = await collection.sendMintNft(provider.sender(), {
        value: toNano('0.2'),
        itemIndex: nextItemIndex,
        amount: toNano('0.1'),
        content: itemContent,
    });
    await provider.waitForDeploy(itemAddress);

    console.log(`NFT minted successfully with index ${nextItemIndex}`);
    console.log('NFT address:', itemAddress.toString());
}