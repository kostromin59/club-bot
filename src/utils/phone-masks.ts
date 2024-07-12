export const phoneMasks = [/^\+79\d{9}$/, /^89\d{9}$/];

export const isValidPhoneNumber = (text?: string) => {
  if (!text) return false;
  return phoneMasks.some((mask) => mask.test(text));
};
