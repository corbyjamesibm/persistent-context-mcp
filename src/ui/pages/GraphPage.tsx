/**
 * Graph visualization page for context relationships
 * Displays Neo4j graph data in an interactive visualization
 */

import React, { useState, useEffect } from 'react';
import {
  Grid,
  Column,
  Button,
  Tile,
  Toggle,
  Slider,
  Dropdown,
  Tag,
  Loading,
  Heading,
} from '@carbon/react';
import { Network_3, ZoomIn, ZoomOut, Restart, Settings } from '@carbon/react/icons';

interface GraphNode {
  id: string;
  label: string;
  type: 'context' | 'template' | 'user' | 'tag';
  size: number;
  color: string;
  metadata: {
    tokenCount?: number;
    usageCount?: number;
    lastAccessed?: string;
  };
}

interface GraphLink {
  source: string;
  target: string;
  relationship: string;
  strength: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const nodeTypes = [
  { id: 'all', text: 'All Types' },
  { id: 'context', text: 'Contexts' },
  { id: 'template', text: 'Templates' },
  { id: 'user', text: 'Users' },
  { id: 'tag', text: 'Tags' },
];

const relationshipTypes = [
  { id: 'all', text: 'All Relationships' },
  { id: 'RELATES_TO', text: 'Related To' },
  { id: 'DERIVED_FROM', text: 'Derived From' },
  { id: 'USES_TEMPLATE', text: 'Uses Template' },
  { id: 'TAGGED_WITH', text: 'Tagged With' },
];

export const GraphPage: React.FC = () => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [nodeSize, setNodeSize] = useState(50);
  const [linkStrength, setLinkStrength] = useState(50);
  const [selectedNodeType, setSelectedNodeType] = useState('all');
  const [selectedRelationType, setSelectedRelationType] = useState('all');

  useEffect(() => {
    fetchGraphData();
  }, [selectedNodeType, selectedRelationType]);

  const fetchGraphData = async () => {
    setLoading(true);
    // Simulate API call to Neo4j
    setTimeout(() => {
      const mockGraphData: GraphData = {
        nodes: [
          {
            id: 'ctx_1',
            label: 'React Component Analysis',
            type: 'context',
            size: 15,
            color: '#0f62fe',
            metadata: { tokenCount: 2450, lastAccessed: '2 hours ago' },
          },
          {
            id: 'ctx_2',
            label: 'User Research Findings',
            type: 'context',
            size: 12,
            color: '#0f62fe',
            metadata: { tokenCount: 1820, lastAccessed: '4 hours ago' },
          },
          {
            id: 'tpl_1',
            label: 'React Analysis Template',
            type: 'template',
            size: 10,
            color: '#8a3ffc',
            metadata: { usageCount: 24 },
          },
          {
            id: 'tag_react',
            label: 'react',
            type: 'tag',
            size: 8,
            color: '#42be65',
            metadata: { usageCount: 45 },
          },
          {
            id: 'tag_analysis',
            label: 'analysis',
            type: 'tag',
            size: 6,
            color: '#42be65',
            metadata: { usageCount: 32 },
          },
          {
            id: 'user_1',
            label: 'Default User',
            type: 'user',
            size: 8,
            color: '#ff832b',
            metadata: {},
          },
        ],
        links: [
          {
            source: 'ctx_1',
            target: 'tpl_1',
            relationship: 'USES_TEMPLATE',
            strength: 0.8,
          },
          {
            source: 'ctx_1',
            target: 'tag_react',
            relationship: 'TAGGED_WITH',
            strength: 0.9,
          },
          {
            source: 'ctx_1',
            target: 'tag_analysis',
            relationship: 'TAGGED_WITH',
            strength: 0.7,
          },
          {
            source: 'ctx_2',
            target: 'tag_analysis',
            relationship: 'TAGGED_WITH',
            strength: 0.8,
          },
          {
            source: 'ctx_1',
            target: 'ctx_2',
            relationship: 'RELATES_TO',
            strength: 0.6,
          },
          {
            source: 'user_1',
            target: 'ctx_1',
            relationship: 'CREATED',
            strength: 1.0,
          },
          {
            source: 'user_1',
            target: 'ctx_2',
            relationship: 'CREATED',
            strength: 1.0,
          },
        ],
      };
      setGraphData(mockGraphData);
      setLoading(false);
    }, 1000);
  };

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
  };

  const handleResetView = () => {
    // Reset graph view to original position
    console.log('Resetting graph view');
  };

  const getNodeTypeColor = (type: string) => {
    switch (type) {
      case 'context': return '#0f62fe';
      case 'template': return '#8a3ffc';
      case 'tag': return '#42be65';
      case 'user': return '#ff832b';
      default: return '#6f6f6f';
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <Heading marginBottom={7}>Graph View</Heading>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <Loading description="Loading graph data..." />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <Heading marginBottom={0}>Graph View</Heading>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button kind="ghost" renderIcon={ZoomIn} hasIconOnly iconDescription="Zoom In" />
          <Button kind="ghost" renderIcon={ZoomOut} hasIconOnly iconDescription="Zoom Out" />
          <Button kind="ghost" renderIcon={Restart} onClick={handleResetView} hasIconOnly iconDescription="Reset View" />
        </div>
      </div>

      <Grid>
        {/* Controls Panel */}
        <Column lg={4} md={4} sm={4}>
          <Tile style={{ marginBottom: '1rem' }}>
            <h4 style={{ marginBottom: '1rem' }}>Graph Controls</h4>
            
            <div style={{ marginBottom: '1rem' }}>
              <Dropdown
                id="node-type-filter"
                titleText="Node Type Filter"
                items={nodeTypes}
                selectedItem={nodeTypes.find(t => t.id === selectedNodeType)}
                onChange={({ selectedItem }) => setSelectedNodeType(selectedItem?.id || 'all')}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <Dropdown
                id="relation-type-filter"
                titleText="Relationship Filter"
                items={relationshipTypes}
                selectedItem={relationshipTypes.find(t => t.id === selectedRelationType)}
                onChange={({ selectedItem }) => setSelectedRelationType(selectedItem?.id || 'all')}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <Toggle
                id="show-labels"
                labelText="Show Labels"
                toggled={showLabels}
                onToggle={setShowLabels}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <Slider
                labelText="Node Size"
                min={20}
                max={100}
                value={nodeSize}
                onChange={({ value }) => setNodeSize(value)}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <Slider
                labelText="Link Strength"
                min={10}
                max={100}
                value={linkStrength}
                onChange={({ value }) => setLinkStrength(value)}
              />
            </div>
          </Tile>

          {/* Node Details */}
          {selectedNode && (
            <Tile>
              <h4 style={{ marginBottom: '1rem' }}>Node Details</h4>
              <div style={{ marginBottom: '0.5rem' }}>
                <strong>{selectedNode.label}</strong>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <Tag type="outline" size="sm" style={{ backgroundColor: selectedNode.color }}>
                  {selectedNode.type}
                </Tag>
              </div>
              <div style={{ fontSize: '0.875rem' }}>
                <div style={{ marginBottom: '0.25rem' }}>
                  <strong>ID:</strong> {selectedNode.id}
                </div>
                {selectedNode.metadata.tokenCount && (
                  <div style={{ marginBottom: '0.25rem' }}>
                    <strong>Tokens:</strong> {selectedNode.metadata.tokenCount}
                  </div>
                )}
                {selectedNode.metadata.usageCount && (
                  <div style={{ marginBottom: '0.25rem' }}>
                    <strong>Usage:</strong> {selectedNode.metadata.usageCount} times
                  </div>
                )}
                {selectedNode.metadata.lastAccessed && (
                  <div style={{ marginBottom: '0.25rem' }}>
                    <strong>Last Accessed:</strong> {selectedNode.metadata.lastAccessed}
                  </div>
                )}
              </div>
            </Tile>
          )}
        </Column>

        {/* Graph Visualization */}
        <Column lg={12} md={4} sm={4}>
          <div className="graph-container">
            <div style={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: 'var(--cds-text-secondary)'
            }}>
              <Network_3 size={64} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <h3>Interactive Graph Visualization</h3>
              <p>Graph visualization would be rendered here using D3.js or similar library</p>
              <p style={{ fontSize: '0.875rem', marginTop: '2rem' }}>
                Nodes: {graphData?.nodes.length} | Links: {graphData?.links.length}
              </p>
              
              {/* Legend */}
              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#0f62fe' }}></div>
                  <span style={{ fontSize: '0.75rem' }}>Contexts</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#8a3ffc' }}></div>
                  <span style={{ fontSize: '0.75rem' }}>Templates</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#42be65' }}></div>
                  <span style={{ fontSize: '0.75rem' }}>Tags</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff832b' }}></div>
                  <span style={{ fontSize: '0.75rem' }}>Users</span>
                </div>
              </div>
            </div>
          </div>
        </Column>
      </Grid>

      {/* Graph Statistics */}
      <Grid style={{ marginTop: '2rem' }}>
        <Column lg={3} md={2} sm={2}>
          <Tile>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--ai-text)' }}>
                {graphData?.nodes.filter(n => n.type === 'context').length}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>Contexts</div>
            </div>
          </Tile>
        </Column>
        <Column lg={3} md={2} sm={2}>
          <Tile>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--ai-text)' }}>
                {graphData?.nodes.filter(n => n.type === 'template').length}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>Templates</div>
            </div>
          </Tile>
        </Column>
        <Column lg={3} md={2} sm={2}>
          <Tile>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--ai-text)' }}>
                {graphData?.links.length}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>Relationships</div>
            </div>
          </Tile>
        </Column>
        <Column lg={3} md={2} sm={2}>
          <Tile>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--ai-text)' }}>
                {graphData?.nodes.filter(n => n.type === 'tag').length}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>Tags</div>
            </div>
          </Tile>
        </Column>
      </Grid>
    </div>
  );
};