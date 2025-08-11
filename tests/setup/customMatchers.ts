/**
 * Custom Jest Matchers
 */

expect.extend({
  toBeValidIP(received: string) {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const pass = ipRegex.test(received) && 
                 received.split('.').every(octet => {
                   const num = parseInt(octet, 10);
                   return num >= 0 && num <= 255;
                 });
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid IP address`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid IP address`,
        pass: false,
      };
    }
  },
});

// Type augmentation for TypeScript
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidIP(): R;
    }
  }
}

export {};