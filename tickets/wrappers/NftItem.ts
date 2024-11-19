import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';

export type RoyaltyParams = {
  factor: number;
  base: number;
  address: Address;
};

export type NftItemConfig = {
  index: number;
  collectionAddress: Address;
  ownerAddress: Address;
  content: string;
};

export function nftItemConfigToCell(config: NftItemConfig): Cell {
  return beginCell()
    .storeUint(config.index, 64)
    .storeAddress(config.collectionAddress)
    .storeAddress(config.ownerAddress)
    .storeRef(beginCell().storeStringRefTail(config.content).endCell())
    .endCell();
}

export class NftItem implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromAddress(address: Address) {
    return new NftItem(address);
  }

  static createFromConfig(config: NftItemConfig, code: Cell, workchain = 0) {
    const data = nftItemConfigToCell(config);
    const init = { code, data };
    return new NftItem(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async sendTransfer(
    provider: ContractProvider,
    via: Sender,
    opts: {
      newOwner: Address;
      responseDestination: Address;
      customPayload?: Cell;
      forwardAmount?: bigint;
      value: bigint;
    }
  ) {
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x5fcc3d14, 32) // transfer op
        .storeUint(0, 64) // query id
        .storeAddress(opts.newOwner)
        .storeAddress(opts.responseDestination)
        .storeBit(false) // null custom_payload
        .storeCoins(opts.forwardAmount || 0)
        .storeBit(false) // empty forward_payload
        .endCell(),
    });
  }

  async sendBurn(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
    }
  ) {
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0x595f07bc, 32) // burn op
        .storeUint(0, 64) // query id
        .endCell(),
    });
  }

  async getNftData(provider: ContractProvider) {
    const { stack } = await provider.get('get_nft_data', []);
    return {
        initialized: stack.readBoolean(),
        index: stack.readNumber(),
        collectionAddress: stack.readAddress(),
        ownerAddress: stack.readAddressOpt(),
        content: stack.readCellOpt()
    };
  }
}
