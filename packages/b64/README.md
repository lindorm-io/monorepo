# @lindorm/b64

A lightweight TypeScript library for Base64 and Base64URL encoding and decoding operations with support for multiple encoding formats and validation utilities.

## Installation

```bash
npm install @lindorm/b64
```

## Features

- **Base64 Encoding/Decoding**: Standard Base64 operations with padding
- **Base64URL Encoding/Decoding**: URL-safe Base64 without padding
- **Multiple Format Support**: Short aliases (`b64`, `b64url`, `b64u`) for convenience
- **Automatic Format Detection**: Smart decoding that handles both formats
- **Buffer and String Support**: Works with both Buffer objects and strings
- **Validation Methods**: Check if strings are valid Base64 or Base64URL
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Zero Dependencies**: Lightweight implementation using Node.js built-ins

## Basic Usage

### Encoding

```typescript
import { B64 } from '@lindorm/b64';

const input = 'Hello, World!';

// Standard Base64 encoding (with padding)
const base64 = B64.encode(input); // 'SGVsbG8sIFdvcmxkIQ=='
const base64Alt = B64.encode(input, 'base64'); // 'SGVsbG8sIFdvcmxkIQ=='
const base64Short = B64.encode(input, 'b64'); // 'SGVsbG8sIFdvcmxkIQ=='

// Base64URL encoding (URL-safe, no padding)
const base64url = B64.encode(input, 'base64url'); // 'SGVsbG8sIFdvcmxkIQ'
const base64urlAlt = B64.encode(input, 'b64url'); // 'SGVsbG8sIFdvcmxkIQ'
const base64urlShort = B64.encode(input, 'b64u'); // 'SGVsbG8sIFdvcmxkIQ'
```

### Decoding

```typescript
// Decode to string (default)
const decoded1 = B64.decode('SGVsbG8sIFdvcmxkIQ=='); // 'Hello, World!'
const decoded2 = B64.toString('SGVsbG8sIFdvcmxkIQ=='); // 'Hello, World!'

// Decode to Buffer
const buffer = B64.toBuffer('SGVsbG8sIFdvcmxkIQ=='); // Buffer containing 'Hello, World!'

// Works with both Base64 and Base64URL automatically
const fromBase64 = B64.decode('SGVsbG8sIFdvcmxkIQ=='); // 'Hello, World!'
const fromBase64URL = B64.decode('SGVsbG8sIFdvcmxkIQ'); // 'Hello, World!'
```

### Working with Buffers

```typescript
// Encode Buffer objects
const buffer = Buffer.from('Binary data', 'utf8');
const encoded = B64.encode(buffer); // Encodes the buffer content
const encodedUrl = B64.encode(buffer, 'base64url'); // URL-safe encoding

// Decode back to Buffer
const originalBuffer = B64.toBuffer(encoded);
console.log(originalBuffer.equals(buffer)); // true
```

## Validation

### Format Validation

```typescript
// Check if string is valid Base64
const isBase64 = B64.isBase64('SGVsbG8sIFdvcmxkIQ=='); // true
const isNotBase64 = B64.isBase64('SGVsbG8sIFdvcmxkIQ'); // false (missing padding)

// Check if string is valid Base64URL
const isBase64URL = B64.isBase64Url('SGVsbG8sIFdvcmxkIQ'); // true
const isNotBase64URL = B64.isBase64Url('SGVsbG8sIFdvcmxkIQ=='); // false (has padding)

// Validation examples
console.log(B64.isBase64('YWJjZGVmZw==')); // true - valid Base64
console.log(B64.isBase64('YWJjZGVmZw')); // false - missing padding
console.log(B64.isBase64Url('YWJjZGVmZw')); // true - valid Base64URL
console.log(B64.isBase64Url('YWJjZGVmZw==')); // false - has padding
```

### Practical Validation Usage

```typescript
function processEncodedData(data: string) {
  if (B64.isBase64(data)) {
    return B64.decode(data);
  } else if (B64.isBase64Url(data)) {
    return B64.decode(data); // Same decode method works for both
  } else {
    throw new Error('Invalid Base64 or Base64URL format');
  }
}

// Usage
const result1 = processEncodedData('SGVsbG8='); // Works with Base64
const result2 = processEncodedData('SGVsbG8'); // Works with Base64URL
```

## Encoding Format Reference

### Base64 vs Base64URL

| Feature | Base64 | Base64URL |
|---------|---------|-----------|
| Characters | `A-Z`, `a-z`, `0-9`, `+`, `/` | `A-Z`, `a-z`, `0-9`, `-`, `_` |
| Padding | Uses `=` for padding | No padding |
| URL Safe | No (`+` and `/` are problematic) | Yes |
| Use Cases | General encoding, emails | URLs, filenames, tokens |

### Format Examples

```typescript
const input = 'Hello, World!';

// All encoding formats for the same input:
B64.encode(input, 'base64');    // 'SGVsbG8sIFdvcmxkIQ=='
B64.encode(input, 'b64');       // 'SGVsbG8sIFdvcmxkIQ=='
B64.encode(input, 'base64url'); // 'SGVsbG8sIFdvcmxkIQ'
B64.encode(input, 'b64url');    // 'SGVsbG8sIFdvcmxkIQ'
B64.encode(input, 'b64u');      // 'SGVsbG8sIFdvcmxkIQ'
```

## Advanced Usage

### Character Set Differences

```typescript
// Text with characters that differ between formats
const specialChars = 'Subject: ?=';

const base64 = B64.encode(specialChars, 'base64');
// 'U3ViamVjdDogPz0=' (uses + and / characters)

const base64url = B64.encode(specialChars, 'base64url'); 
// 'U3ViamVjdDogPz0' (uses - and _ characters, no padding)

// Both decode to the same result
console.log(B64.decode(base64));    // 'Subject: ?='
console.log(B64.decode(base64url)); // 'Subject: ?='
```

### Binary Data Handling

```typescript
// Working with binary data
const binaryData = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
const buffer = Buffer.from(binaryData);

const encoded = B64.encode(buffer);
const decoded = B64.toBuffer(encoded);

console.log(Array.from(decoded)); // [72, 101, 108, 108, 111]
console.log(decoded.toString()); // 'Hello'
```

### JWT-style Tokens

```typescript
// Base64URL is commonly used in JWT tokens
const header = { alg: 'HS256', typ: 'JWT' };
const payload = { sub: '1234567890', name: 'John Doe' };

const encodedHeader = B64.encode(JSON.stringify(header), 'base64url');
const encodedPayload = B64.encode(JSON.stringify(payload), 'base64url');

console.log(`${encodedHeader}.${encodedPayload}.signature`);
// Creates JWT-style token format

// Decode JWT parts
const decodedHeader = JSON.parse(B64.decode(encodedHeader));
const decodedPayload = JSON.parse(B64.decode(encodedPayload));
```

## Type Definitions

```typescript
// Supported encoding formats
type Base64Encoding = 'base64' | 'base64url' | 'b64' | 'b64url' | 'b64u';

// Main class interface
class B64 {
  // Encoding methods
  static encode(input: Buffer | string, encoding?: Base64Encoding): string;
  
  // Decoding methods
  static decode(input: string, encoding?: Base64Encoding): string;
  static toBuffer(input: string, encoding?: Base64Encoding): Buffer;
  static toString(input: string, encoding?: Base64Encoding): string;
  
  // Validation methods
  static isBase64(input: string): boolean;
  static isBase64Url(input: string): boolean;
}
```

## Performance Considerations

- **Encoding**: Direct Buffer operations for optimal performance
- **Decoding**: Smart format detection without overhead
- **Validation**: Regex-based validation for fast format checking
- **Memory**: Efficient Buffer handling without unnecessary copies

## Common Use Cases

### URL-Safe Tokens

```typescript
// Generate URL-safe tokens
const token = B64.encode(crypto.randomBytes(32), 'base64url');
// Safe to use in URLs, filenames, etc.
```

### Data URIs

```typescript
// Create data URIs with Base64
const imageData = fs.readFileSync('image.png');
const base64Image = B64.encode(imageData);
const dataUri = `data:image/png;base64,${base64Image}`;
```

### API Response Encoding

```typescript
// Encode binary data for JSON APIs
const binaryData = Buffer.from('Binary content');
const response = {
  data: B64.encode(binaryData),
  encoding: 'base64'
};

// Decode on client
const originalData = B64.toBuffer(response.data);
```

## Error Handling

The library uses Node.js built-in Buffer methods, which will throw standard errors for invalid input:

```typescript
try {
  const result = B64.decode('invalid-base64!@#');
} catch (error) {
  console.log('Invalid Base64 input');
}

// Validate before decoding to avoid errors
if (B64.isBase64(input) || B64.isBase64Url(input)) {
  const result = B64.decode(input);
}
```

## Dependencies

This package has zero external dependencies and relies only on Node.js built-in modules:
- `Buffer` - For encoding/decoding operations

## License

AGPL-3.0-or-later