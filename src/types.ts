/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ToolType =
  | 'image-resizer'
  | 'code-formatter'
  | 'pdf-converter'
  | 'unit-converter'
  | 'qr-generator'
  | 'password-manager'
  | 'keyboard-mouse-test'
  | 'webcam-test'
  | 'microphone-test'
  | 'base64-tool'
  | 'country-codes'
  | 'character-counter'
  | 'json-validator'
  | 'screen-color-test';

export interface CardTool {
  id: ToolType;
  title: string;
  description: string;
  icon: string;
  category: 'Creative' | 'Developer' | 'Office' | 'Utility' | 'Marketing' | 'Security' | 'Hardware';
  /** Optional per-tool accent values — the shell palette drives the visuals today. */
  bgColor?: string;
  textColor?: string;
}

export interface PasswordRecord {
  id: string;
  site: string;
  username: string;
  strength: 'weak' | 'medium' | 'strong' | 'ultimate';
  createdAt: string;
}
