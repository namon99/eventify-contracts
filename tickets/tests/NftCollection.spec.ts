import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, Cell, Dictionary, toNano, DictionaryValue } from '@ton/core';
import { NftCollection } from '../wrappers/NftCollection';
import { NftItem } from '../wrappers/NftItem';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { timeStamp } from 'console';

describe('NftCollection', () => {
  let code: Cell;
  let itemCode: Cell;
  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let user: SandboxContract<TreasuryContract>;
  let collection: SandboxContract<NftCollection>;

  beforeAll(async () => {
    code = await compile('NftCollection');
    itemCode = await compile('NftItem');
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury('deployer');
    user = await blockchain.treasury('user');

    collection = blockchain.openContract(
      NftCollection.createFromConfig({
        ownerAddress: deployer.address,
        nextItemIndex: 0,
        collectionContent: "collectionContent",
        commonContent: "commonContent",
        nftItemCode: itemCode,
        royaltyParams: {
          factor: 100,
          base: 1000,
          address: deployer.address,
        },
        mintPrice: toNano('0.1'),
        maxSupply: 1000,
        endTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        refundPercent: 5000, // 50%
        ticketsSold: 0,
      }, code)
    );

    const deployResult = await collection.sendDeploy(deployer.getSender(), toNano('0.05'));

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: collection.address,
      deploy: true,
      success: true,
    });
  });

  it('should deploy', async () => {
    const data = await collection.getCollectionData();
    expect(data.nextItemIndex).toBe(0);
    expect(data.ownerAddress.equals(deployer.address)).toBe(true);
  });

  it('should mint NFT', async () => {
    // Get initial tickets sold
    const initialTickets = await collection.getTicketsSold();
    
    const result = await collection.sendMintNft(
      deployer.getSender(),
      {
        value: toNano('0.2'),
        itemIndex: 0,
        amount: toNano('0.1'),
        content: 'itemContent',
      }
    );

    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: collection.address,
      success: true,
    });

    // Check tickets sold increased
    const finalTickets = await collection.getTicketsSold();
    expect(finalTickets).toBe(initialTickets + 1);
  });

  it('should not mint if price is insufficient', async () => {
    const initialTickets = await collection.getTicketsSold();
    
    const result = await collection.sendMintNft(
      deployer.getSender(),
      {
        value: toNano('0.2'),
        itemIndex: 0,
        amount: toNano('0.05'), // Less than mintPrice
        content: 'itemContent',
      }
    );

    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: collection.address,
      success: false,
      exitCode: 408,
    });

    // Check tickets sold didn't change
    const finalTickets = await collection.getTicketsSold();
    expect(finalTickets).toBe(initialTickets);
  });

  it('should not mint after end time', async () => {
    const initialTickets = await collection.getTicketsSold();
    
    blockchain.now = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now

    const result = await collection.sendMintNft(
      deployer.getSender(),
      {
        value: toNano('0.2'),
        itemIndex: 0,
        amount: toNano('0.1'),
        content: 'itemContent',
      }
    );

    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: collection.address,
      success: false,
      exitCode: 406,
    });

    // Check tickets sold didn't change
    const finalTickets = await collection.getTicketsSold();
    expect(finalTickets).toBe(initialTickets);
  });

  it('should batch mint NFTs', async () => {
    const initialTickets = await collection.getTicketsSold();
    
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
    } as DictionaryValue<{ amount: bigint, content: Cell }>);

    const numNfts = 2;
    for (let i = 0; i < numNfts; i++) {
        deployList.set(i, { 
            amount: toNano('0.1'), 
            content: beginCell().storeUint(i, 8).endCell() 
        });
    }

    const result = await collection.sendBatchMintNft(
      deployer.getSender(),
      {
        value: toNano('0.5'),
        deployList,
      }
    );

    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: collection.address,
      success: true,
    });

    // Check tickets sold increased by the number of minted NFTs
    const finalTickets = await collection.getTicketsSold();
    expect(finalTickets).toBe(initialTickets + numNfts);
  });

  it('should change owner', async () => {
    const result = await collection.sendChangeOwner(
      deployer.getSender(),
      {
        value: toNano('0.05'),
        newOwner: user.address,
      }
    );

    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: collection.address,
      success: true,
    });

    const data = await collection.getCollectionData();
    expect(data.ownerAddress.equals(user.address)).toBe(true);
  });

  it('should change content', async () => {
    const newContent = beginCell().storeUint(1, 8).endCell();
    const result = await collection.sendChangeContent(
      deployer.getSender(),
      {
        value: toNano('0.05'),
        newContent,
      }
    );

    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: collection.address,
      success: true,
    });
  });

  it('should get correct royalty params', async () => {
    const royalty = await collection.getRoyaltyParams();
    expect(royalty.factor).toBe(100);
    expect(royalty.base).toBe(1000);
    expect(royalty.address.equals(deployer.address)).toBe(true);
  });

  it('should get correct collection limits', async () => {
    const limits = await collection.getCollectionLimits();
    expect(limits.mintPrice).toBe(parseInt(toNano('0.1').toString()));
    expect(limits.maxSupply).toBe(1000);
    expect(limits.refundPercent).toBe(5000);
  });

  it('should get NFT address by index', async () => {
    const nftAddress = await collection.getNftAddressByIndex(0);
    expect(nftAddress).not.toBeNull();
  });

  it('should get NFT content', async () => {
    const content = await collection.getNftContent(
      0,
      beginCell().storeStringRefTail("individualContent").endCell()
    );
    expect(content).not.toBeNull();
  });
});