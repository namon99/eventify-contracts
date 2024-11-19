import { toNano, Address } from '@ton/core';
import { NftItem } from '../wrappers/NftItem';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider, args: string[]) {
    const [nftAddress, newOwnerAddress] = args;
    
    if (!nftAddress || !newOwnerAddress) {
        console.log('Usage: blueprint run transferNft <nft_address> <new_owner_address>');
        return;
    }

    const nftItem = provider.open(NftItem.createFromAddress(Address.parse(nftAddress)));

    await nftItem.sendTransfer(provider.sender(), {
        value: toNano('0.05'),
        newOwner: Address.parse(newOwnerAddress),
        responseDestination: provider.sender().address!,
        forwardAmount: toNano('0.01'),
    });

    console.log('NFT transferred successfully');
}