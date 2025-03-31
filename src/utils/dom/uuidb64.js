import { uuid4 } from "./uuid4";
/** @returns {string} */
export function uuidb64() {
    return btoa(uuid4());
}

export default uuidb64;