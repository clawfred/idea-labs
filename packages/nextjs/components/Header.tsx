"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hardhat } from "viem/chains";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useOutsideClick, useTargetNetwork } from "~~/hooks/scaffold-eth";

type HeaderMenuLink = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

export const menuLinks: HeaderMenuLink[] = [
  {
    label: "Ideas",
    href: "/",
  },
];

export const HeaderMenuLinks = () => {
  const pathname = usePathname();

  return (
    <>
      {menuLinks.map(({ label, href, icon }) => {
        const isActive = pathname === href;
        return (
          <li key={href}>
            <Link
              href={href}
              passHref
              className={`${
                isActive ? "bg-purple-500/20 text-purple-300" : "text-white/60"
              } hover:bg-purple-500/10 hover:text-purple-300 py-2 px-4 rounded-xl text-sm font-medium transition-all`}
            >
              {icon}
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </>
  );
};

/**
 * FredLabs Header - Modern Glassmorphism
 */
export const Header = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  const burgerMenuRef = useRef<HTMLDetailsElement>(null);
  useOutsideClick(burgerMenuRef, () => {
    burgerMenuRef?.current?.removeAttribute("open");
  });

  return (
    <div className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-white/10">
      <div className="navbar min-h-0 py-3 px-4 sm:px-6">
        <div className="navbar-start w-auto lg:w-1/2">
          <details className="dropdown" ref={burgerMenuRef}>
            <summary className="btn btn-ghost lg:hidden hover:bg-white/10 p-2">
              <Bars3Icon className="h-6 w-6 text-white" />
            </summary>
            <ul
              className="menu menu-compact dropdown-content mt-3 p-3 shadow-2xl bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl w-56"
              onClick={() => {
                burgerMenuRef?.current?.removeAttribute("open");
              }}
            >
              <HeaderMenuLinks />
            </ul>
          </details>

          <Link href="/" passHref className="flex items-center gap-3 ml-2 lg:ml-0 group">
            {/* Logo */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-xl shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform">
              🤖
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xl bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                FredLabs
              </span>
              <span className="text-[10px] text-white/40 hidden sm:block">by Clawfred • $FRED</span>
            </div>
          </Link>

          <ul className="hidden lg:flex lg:flex-nowrap menu menu-horizontal px-4 gap-2">
            <HeaderMenuLinks />
          </ul>
        </div>

        <div className="navbar-end grow gap-3">
          <RainbowKitCustomConnectButton />
          {isLocalNetwork && <FaucetButton />}
        </div>
      </div>
    </div>
  );
};
