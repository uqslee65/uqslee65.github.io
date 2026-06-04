// The simulator now lives in the sibling package ../zigan-simulation (single source of
// truth). This thin shim re-exports it so the website's pages keep importing
// `../components/BubbleSimulator` unchanged.
export { BubbleSimulator as default } from 'zigan-simulation';
