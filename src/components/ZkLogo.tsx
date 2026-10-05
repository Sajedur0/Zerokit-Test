/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import logoUrl from '../../assets/logo.png';

interface ZkLogoProps {
  className?: string;
  size?: number | string;
}

export default function ZkLogo({ className = 'w-10 h-10', size }: ZkLogoProps) {
  const style = size ? { width: size, height: size } : undefined;

  return (
    <img
      src={logoUrl}
      alt="ZeroKit Logo"
      className={`object-contain ${className}`}
      style={style}
      referrerPolicy="no-referrer"
    />
  );
}

