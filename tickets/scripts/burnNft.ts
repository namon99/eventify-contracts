import { toNano, Address } from '@ton/core';
import { NftItem } from '../wrappers/NftItem';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const [nftAddress] = args;
    
    if (!nftAddress) {
        console.log('Usage: blueprint run burnNft <nft_address>');
        return;
    }

    const nftItem = provider.open(NftItem.createFromAddress(Address.parse(nftAddress)));

    await nftItem.sendBurn(provider.sender(), {
        value: toNano('0.05'),
    });

    console.log('NFT burned successfully');
}