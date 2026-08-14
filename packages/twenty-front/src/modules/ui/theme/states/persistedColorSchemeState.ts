import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';
import { type ColorScheme } from '@/workspace-member/types/WorkspaceMember';

export const persistedColorSchemeState = createAtomState<ColorScheme>({
  key: 'persistedColorSchemeState',
  defaultValue: 'Dark',
  useLocalStorage: true,
});
