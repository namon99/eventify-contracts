import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, Cell, toNano, beginCell } from '@ton/core';
import { NftItem } from '../wrappers/NftItem';
import '@ton/test-utils';
import { compile } from '@ton/blueprint';
import { NftCollection } from '../wrappers/NftCollection';

describe('NftItem', () => {
  let code: Cell;
  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let user: SandboxContract<TreasuryContract>;
  let nftItem: SandboxContract<NftItem>;
  let collection: Address;

  beforeAll(async () => {
    code = await compile('NftItem');
  });

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    collection = Address.parse('EQD4FPq-PRDieyQKkizFTRtSDyucUIqrj0v_zXJmqaDp6_0t');
    deployer = await blockchain.treasury('deployer');
    user = await blockchain.treasury('user');

    nftItem = blockchain.openContract(
      NftItem.createFromConfig({
        index: 0,
        collectionAddress: collection,
        ownerAddress: deployer.address,
        content: 'individualContent',
      }, code)
    );

    const deployResult = await nftItem.sendDeploy(deployer.getSender(), toNano('0.05'));

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: nftItem.address,
      deploy: true,
      success: true,
    });
  });

  it('should deploy', async () => {
    const data = await nftItem.getNftData();
    expect(data.index).toBe(0);
    expect(data.initialized).toBe(true);
    expect(data.collectionAddress.equals(collection)).toBe(true);
    expect(data.ownerAddress?.equals(deployer.address)).toBe(true);
    expect(data.content?.beginParse().loadStringRefTail()).toBe('individualContent');
  });

  it('should transfer ownership', async () => {
    const result = await nftItem.sendTransfer(
      deployer.getSender(),
      {
        value: toNano('0.05'),
        newOwner: user.address,
        responseDestination: deployer.address,
        forwardAmount: toNano('0.01'),
      }
    );

    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: nftItem.address,
      success: true,
    });

    const data = await nftItem.getNftData();
    expect(data.ownerAddress?.equals(user.address)).toBe(true);
  });

  it('should not transfer if not owner', async () => {
    const result = await nftItem.sendTransfer(
      user.getSender(),
      {
        value: toNano('0.05'),
        newOwner: user.address,
        responseDestination: user.address,
        forwardAmount: toNano('0.01'),
      }
    );

    expect(result.transactions).toHaveTransaction({
      from: user.address,
      to: nftItem.address,
      success: false,
      exitCode: 401,
    });
  });

  it('should burn token', async () => {
    const result = await nftItem.sendBurn(
      deployer.getSender(),
      {
        value: toNano('0.05'),
      }
    );

    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: nftItem.address,
      op: 0x595f07bc,
      success: true,
      exitCode: 0
    });

    // Check that token data is cleared
    const data = await nftItem.getNftData();
    expect(data.ownerAddress).toBeNull();
  });

  it('should not burn if not owner', async () => {
    const result = await nftItem.sendBurn(
      user.getSender(),
      {
        value: toNano('0.05'),
      }
    );

    expect(result.transactions).toHaveTransaction({
      from: user.address,
      to: nftItem.address,
      op: 0x595f07bc,
      success: false,
      exitCode: 401
    });

    const data = await nftItem.getNftData();
    expect(data.initialized).toBe(true);
    expect(data.ownerAddress?.equals(deployer.address)).toBe(true);
  });
});
