/**
 * Represents a BitSet, a data structure to handle a set of bits (0s and 1s).
 */
export default class BitSet {

    /**
     * Creates a BitSet.
     *
     * @param {number|string} input - The size of the bitset (number of bits) or a string representing the bitset.
     */
    constructor(input) {
        if (typeof input === 'string') {
            this.bits = input.split('').map(Number);
        } else if (typeof input === 'number') {
            this.bits = new Array(input).fill(0);
        } else {
            throw new Error('Invalid input type');
        }
    }

    /**
     * Counts the number of bits set to 1 in the BitSet.
     *
     * @returns {number} The count of bits set to 1.
     */
    popCount() {
        return this.bits.filter(b => b === 1).length;
    }

    /**
     * Sets the value of the bit at a specific index.
     *
     * @param {number} index - The index of the bit to set.
     * @param {number} value - The value to set at the index (0 or 1).
     */
    set(index, value) {
        if (index < 0 || index >= this.bits.length) {
            throw new Error('Index out of range');
        }
        this.bits[index] = value ? 1 : 0;
    }

    /**
     * Gets the value of the bit at a specific index.
     *
     * @param {number} index - The index of the bit to get.
     * @returns {number} The value of the bit at the specified index, or -1 if the index is out of range.
     */
    get(index) {
        if (index < 0 || index >= this.bits.length) {
            return -1;
        }
        return this.bits[index];
    }

    /**
     * Returns a string representation of the BitSet.
     *
     * @returns {string} The string representation of the BitSet.
     */
    toString() {
        return this.bits.join('');
    }
}