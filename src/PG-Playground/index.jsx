import React, { useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react';
import { Allotment } from "allotment";
import "allotment/dist/style.css";
import styles from './index.module.scss'
import Header from '../components/Header/index.jsx'
import PlayerEditor from '../components/PlayerEditor/index.jsx'
import Inspector from '../components/Inspector/index.jsx'

export default function InternshipProgram() {
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  return (
   <div style={{width: '100%', height: '100vh', overflow: 'hidden'}}>
    <Header />
    <div style={{ height: 'calc(100vh - 50px)' }}>
      <ReactFlowProvider>
        <Allotment>
          <Allotment.Pane>
            <PlayerEditor onNodeSelect={setSelectedNodeId} />
          </Allotment.Pane>
          <Allotment.Pane preferredSize={450} minSize={450} maxSize={450}>
            <Inspector selectedNodeId={selectedNodeId} />
          </Allotment.Pane>
        </Allotment>
      </ReactFlowProvider>
    </div>
   </div>
  )
}