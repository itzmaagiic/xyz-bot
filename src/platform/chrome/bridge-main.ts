/** Chrome: content script running in the page's MAIN world (manifest `world: "MAIN"`). */
import { installBridge } from '../../core/bridge/page-bridge';

installBridge();
