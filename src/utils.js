export const mapCelsiusToRadians = (celsius) => {
  return celsius * (Math.PI/180);
};

export const camelCaseToDash = (str) => {
  return str.replace( /([a-z])([A-Z])/g, '$1-$2' ).toLowerCase();
};