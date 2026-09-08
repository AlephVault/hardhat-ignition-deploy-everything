import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();
const { anyValue } = await import("@nomicfoundation/hardhat-ethers-chai-matchers/withArgs");

describe("Lock", function () {
  async function deployOneYearLockFixture() {
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    const ONE_GWEI = 1_000_000_000n;

    const lockedAmount = ONE_GWEI;
    const unlockTime = (await networkHelpers.time.latest()) + ONE_YEAR_IN_SECS;

    const [owner, otherAccount] = await ethers.getSigners();

    const lock = await ethers.deployContract("Lock", [unlockTime], {
      value: lockedAmount
    });

    return { lock, unlockTime, lockedAmount, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Should set the right unlockTime", async function () {
      const { lock, unlockTime } = await networkHelpers.loadFixture(deployOneYearLockFixture);

      expect(await lock.unlockTime()).to.equal(unlockTime);
    });

    it("Should set the right owner", async function () {
      const { lock, owner } = await networkHelpers.loadFixture(deployOneYearLockFixture);

      expect(await lock.owner()).to.equal(owner.address);
    });

    it("Should receive and store the funds to lock", async function () {
      const { lock, lockedAmount } = await networkHelpers.loadFixture(
        deployOneYearLockFixture
      );

      expect(await ethers.provider.getBalance(lock.target)).to.equal(
        lockedAmount
      );
    });

    it("Should fail if the unlockTime is not in the future", async function () {
      const latestTime = await networkHelpers.time.latest();
      await expect(ethers.deployContract("Lock", [latestTime], { value: 1n })).to.be.revertedWith(
        "Unlock time should be in the future"
      );
    });
  });

  describe("Withdrawals", function () {
    describe("Validations", function () {
      it("Should revert with the right error if called too soon", async function () {
        const { lock } = await networkHelpers.loadFixture(deployOneYearLockFixture);

        await expect(lock.withdraw()).to.be.revertedWith(
          "You can't withdraw yet"
        );
      });

      it("Should revert with the right error if called from another account", async function () {
        const { lock, unlockTime, otherAccount } = await networkHelpers.loadFixture(
          deployOneYearLockFixture
        );

        await networkHelpers.time.increaseTo(unlockTime);

        await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWith(
          "You aren't the owner"
        );
      });

      it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
        const { lock, unlockTime } = await networkHelpers.loadFixture(
          deployOneYearLockFixture
        );

        await networkHelpers.time.increaseTo(unlockTime);

        await lock.withdraw();
      });
    });

    describe("Events", function () {
      it("Should emit an event on withdrawals", async function () {
        const { lock, unlockTime, lockedAmount } = await networkHelpers.loadFixture(
          deployOneYearLockFixture
        );

        await networkHelpers.time.increaseTo(unlockTime);

        await expect(lock.withdraw())
          .to.emit(lock, "Withdrawal")
          .withArgs(lockedAmount, anyValue);
      });
    });

    describe("Transfers", function () {
      it("Should transfer the funds to the owner", async function () {
        const { lock, unlockTime, lockedAmount, owner } = await networkHelpers.loadFixture(
          deployOneYearLockFixture
        );

        await networkHelpers.time.increaseTo(unlockTime);

        await expect(lock.withdraw()).to.changeEtherBalances(
          ethers,
          [owner, lock],
          [lockedAmount, -lockedAmount]
        );
      });
    });
  });
});
