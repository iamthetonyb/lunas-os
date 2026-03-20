
import * as schema from '@/db/schema';

console.log('Schema keys:', Object.keys(schema));

for (const [key, value] of Object.entries(schema)) {
    if (value === undefined) {
        console.error(`ERROR: Schema export "${key}" is undefined!`);
    } else {
        // console.log(`OK: ${key}`);
    }
}
console.log('Done checking schema.');
