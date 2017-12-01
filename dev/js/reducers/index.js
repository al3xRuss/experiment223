import {combineReducers} from 'redux';
import PhonemeReducer from './reducer-phoneme';
import SelectedPhonemeReducer from './reducer-selected-phoneme';

const allReducers = combineReducers({
    phoneme: PhonemeReducer,
    selectedPhoneme: SelectedPhonemeReducer
})

export default allReducers;