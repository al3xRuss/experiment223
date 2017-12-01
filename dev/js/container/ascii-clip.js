import React, {Component} from 'react';
import {connect} from 'react-redux';

class AsciiClip extends Component {
    render() {
        if(!this.props.phoneme){
            return (<h4 className="frames-loading">Loading...</h4>);
        }
        return (
            <div>
                <ol className="frames result-preview-wrap preview-mono">
                {
                    this.props.phoneme.map((line, lineIndex) => {
                        return(<li key={'line'+lineIndex}>{line}</li>)
                    })
                }
                </ol>
            </div>
        )
    }
}

function mapStateToProps(state) {
    return {
        frame: state.selectedFrame,
        phoneme: state.selectedPhoneme
    }
}

export default connect(mapStateToProps)(AsciiClip);