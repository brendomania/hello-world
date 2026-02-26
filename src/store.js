import { atom } from 'jotai';

export const isLoadedAtom = atom(false);
export const branchesAtom = atom([]);
export const baseBranchAtom = atom('');
export const compareBranchAtom = atom('');
export const diffsAtom = atom([]);
export const loadingDiffsAtom = atom(false);
