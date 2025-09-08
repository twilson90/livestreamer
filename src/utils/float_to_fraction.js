export function float_to_fraction(decimal, tolerance = 0.0001) {
    // Handle negative numbers
    const sign = decimal < 0 ? -1 : 1;
    decimal = Math.abs(decimal);
    
    // Handle whole numbers
    if (Math.abs(decimal - Math.round(decimal)) < tolerance) {
        return `${sign * Math.round(decimal)}/1`;
    }
    
    let numerator = 1;
    let denominator = 1;
    let error = decimal;
    
    // Find best fraction approximation using Farey sequence
    for (let d = 2; d <= 10000; d++) {
        const n = Math.round(decimal * d);
        const currentError = Math.abs(decimal - n/d);
        
        if (currentError < error) {
            error = currentError;
            numerator = n;
            denominator = d;
            
            // Early exit if we've reached acceptable precision
            if (error < tolerance) break;
        }
    }
    
    // Simplify the fraction
    const gcd = greatest_common_divisor(numerator, denominator);
    numerator /= gcd;
    denominator /= gcd;
    
    return denominator === 1 
        ? `${sign * numerator}/1` 
        : `${sign * numerator}/${denominator}`;
}

// Helper function to calculate greatest common divisor
export function greatest_common_divisor(a, b) {
    return b ? greatest_common_divisor(b, a % b) : a;
}

export default float_to_fraction;