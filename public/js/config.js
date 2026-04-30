// Static config — categories and storage areas are now loaded dynamically from the API

const TYPE_LABELS = { prop: 'Prop', furniture: 'Furniture', costume: 'Costume' };
const TYPE_ICONS  = { prop: '🎭', furniture: '🪑', costume: '👗' };
const API = '/api';

// Runtime cache filled on page load
window.APP_STATE = {
  categories:   { prop: [], furniture: [], costume: [] },
  storageAreas: [],
};
