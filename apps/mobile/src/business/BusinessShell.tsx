import { MobileShell } from '../screens/MobileShell';

/**
 * The Business product's root.
 *
 * It currently composes the same shell as Individual, because at this stage the
 * two differ in palette and wording only — both of which are already injected
 * (`useTheme().colors` and `useTheme().copy`). Duplicating ten screens to change
 * labels would mean fixing every bug twice while both products are under active
 * development.
 *
 * This file is the seam. As Business grows its own behaviour — shift rosters,
 * site management, supervisor views — those screens land in src/business/ and
 * get swapped in here one at a time, without touching the Individual app. When
 * the Business app eventually splits into its own project, it takes
 * src/business/ plus the shared lib/, components/ and state/ folders, and drops
 * the Individual copy from src/copy.ts.
 */
export function BusinessShell() {
  return <MobileShell />;
}
