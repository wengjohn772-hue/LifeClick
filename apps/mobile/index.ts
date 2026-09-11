import { registerRootComponent } from 'expo';

// Imported for its side effects and BEFORE the app component: TaskManager must
// have the background location task defined by the time the bundle finishes
// evaluating, because the OS can relaunch the app straight into that task with
// no UI mounted.
import './src/lib/locationTask';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
