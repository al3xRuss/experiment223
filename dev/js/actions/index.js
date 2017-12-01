export const selectPhoneme = (phoneme) => {
    return {
        type: "PHONEME_SELECTED",
        payload: phoneme
    }
}