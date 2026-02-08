import React from "react";
import Link from "next/link";
import { useFetchNativeCurrencyPrice } from "@scaffold-ui/hooks";
import { hardhat } from "viem/chains";
import { CurrencyDollarIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { SwitchTheme } from "~~/components/SwitchTheme";
import { Faucet } from "~~/components/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";

/**
 * FredLabs Footer
 */
export const Footer = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;
  const { price: nativeCurrencyPrice } = useFetchNativeCurrencyPrice();

  return (
    <div className="min-h-0 py-5 px-1 mb-11 lg:mb-0">
      <div>
        <div className="fixed flex justify-between items-center w-full z-10 p-4 bottom-0 left-0 pointer-events-none">
          <div className="flex flex-col md:flex-row gap-2 pointer-events-auto">
            {nativeCurrencyPrice > 0 && (
              <div>
                <div className="btn btn-primary btn-sm font-normal gap-1 cursor-auto rounded-xl bg-white/10 border-white/20 backdrop-blur-sm">
                  <CurrencyDollarIcon className="h-4 w-4" />
                  <span>{nativeCurrencyPrice.toFixed(2)}</span>
                </div>
              </div>
            )}
            {isLocalNetwork && (
              <>
                <Faucet />
                <Link
                  href="/blockexplorer"
                  passHref
                  className="btn btn-primary btn-sm font-normal gap-1 rounded-xl bg-white/10 border-white/20 backdrop-blur-sm"
                >
                  <MagnifyingGlassIcon className="h-4 w-4" />
                  <span>Block Explorer</span>
                </Link>
              </>
            )}
          </div>
          <SwitchTheme className={`pointer-events-auto ${isLocalNetwork ? "self-end md:self-auto" : ""}`} />
        </div>
      </div>
      <div className="w-full">
        <ul className="menu menu-horizontal w-full">
          <div className="flex justify-center items-center gap-2 text-sm w-full text-white/40">
            <div className="text-center">
              <a
                href="https://github.com/clawdbotatg/idea-labs"
                target="_blank"
                rel="noreferrer"
                className="hover:text-purple-400 transition-colors"
              >
                GitHub
              </a>
            </div>
            <span>·</span>
            <div className="flex justify-center items-center gap-2">
              <p className="m-0 text-center">
                Built with 🤖 by{" "}
                <a
                  href="https://twitter.com/clawfred"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-purple-400 transition-colors"
                >
                  Clawfred
                </a>
              </p>
            </div>
            <span>·</span>
            <div className="text-center">
              <a
                href="https://basescan.org/token/0xCCF66470A962464CFF146b34a7cC8c235b068B07"
                target="_blank"
                rel="noreferrer"
                className="hover:text-purple-400 transition-colors"
              >
                $FRED on Base
              </a>
            </div>
          </div>
        </ul>
      </div>
    </div>
  );
};
