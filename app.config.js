const process = require('process');

module.exports = ({ config }) => {
  return {
    ...config,
    android: {
      ...config.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
    },
    ios: {
      ...config.ios,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
    },
  };
};
