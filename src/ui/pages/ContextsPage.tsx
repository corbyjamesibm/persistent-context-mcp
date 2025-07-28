/**
 * Contexts listing and management page
 * Provides search, filter, and CRUD operations for contexts
 */

import React, { useState, useEffect } from 'react';
import {
  Grid,
  Column,
  Button,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableSelectAll,
  TableSelectRow,
  TableBatchActions,
  TableBatchAction,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  TableToolbarMenu,
  TableToolbarAction,
  Pagination,
  Tag,
  OverflowMenu,
  OverflowMenuItem,
  Modal,
  TextInput,
  TextArea,
  Dropdown,
  FormGroup,
  Heading,
} from '@carbon/react';
import {
  Add,
  Edit,
  TrashCan,
  View,
  Download,
  Filter,
  Settings,
} from '@carbon/react/icons';

interface Context {
  id: string;
  title: string;
  type: string;
  status: string;
  updatedAt: string;
  tokenCount: number;
  tags: string[];
}

const contextTypes = [
  { id: 'planning', text: 'Planning' },
  { id: 'analysis', text: 'Analysis' },
  { id: 'development', text: 'Development' },
  { id: 'bmad_workflow', text: 'BMad Workflow' },
  { id: 'general', text: 'General' },
];

export const ContextsPage: React.FC = () => {
  const [contexts, setContexts] = useState<Context[]>([]);
  const [selectedRows, setSelectedRows] = useState<readonly string[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedContext, setSelectedContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'general',
    tags: '',
  });

  useEffect(() => {
    fetchContexts();
  }, [currentPage, pageSize, searchValue]);

  const fetchContexts = async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      const mockContexts: Context[] = [
        {
          id: 'ctx_1',
          title: 'React Component Analysis',
          type: 'development',
          status: 'active',
          updatedAt: '2 hours ago',
          tokenCount: 2450,
          tags: ['react', 'analysis', 'frontend'],
        },
        {
          id: 'ctx_2',
          title: 'User Research Findings',
          type: 'analysis',
          status: 'active',
          updatedAt: '4 hours ago',
          tokenCount: 1820,
          tags: ['research', 'ux', 'insights'],
        },
        {
          id: 'ctx_3',
          title: 'API Documentation Review',
          type: 'planning',
          status: 'archived',
          updatedAt: '1 day ago',
          tokenCount: 3200,
          tags: ['api', 'documentation'],
        },
        {
          id: 'ctx_4',
          title: 'BMad Framework Implementation',
          type: 'bmad_workflow',
          status: 'active',
          updatedAt: '3 days ago',
          tokenCount: 4100,
          tags: ['bmad', 'workflow', 'architecture'],
        },
      ];
      setContexts(mockContexts);
      setLoading(false);
    }, 800);
  };

  const headers = [
    { key: 'title', header: 'Title' },
    { key: 'type', header: 'Type' },
    { key: 'status', header: 'Status' },
    { key: 'tags', header: 'Tags' },
    { key: 'updatedAt', header: 'Last Updated' },
    { key: 'tokenCount', header: 'Tokens' },
    { key: 'actions', header: 'Actions' },
  ];

  const handleCreateContext = () => {
    setFormData({ title: '', content: '', type: 'general', tags: '' });
    setCreateModalOpen(true);
  };

  const handleEditContext = (context: Context) => {
    setSelectedContext(context);
    setFormData({
      title: context.title,
      content: '',
      type: context.type,
      tags: context.tags.join(', '),
    });
    setEditModalOpen(true);
  };

  const handleSaveContext = async () => {
    // API call to save context
    console.log('Saving context:', formData);
    setCreateModalOpen(false);
    setEditModalOpen(false);
    fetchContexts();
  };

  const handleDeleteContexts = async (ids: string[]) => {
    // API call to delete contexts
    console.log('Deleting contexts:', ids);
    fetchContexts();
    setSelectedRows([]);
  };

  const rows = contexts.map((context) => ({
    ...context,
    tags: (
      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
        {context.tags.map((tag) => (
          <Tag key={tag} type="outline" size="sm">
            {tag}
          </Tag>
        ))}
      </div>
    ),
    status: (
      <Tag type={context.status === 'active' ? 'green' : 'gray'} size="sm">
        {context.status}
      </Tag>
    ),
    actions: (
      <OverflowMenu flipped size="sm">
        <OverflowMenuItem itemText="View" onClick={() => console.log('View', context.id)} />
        <OverflowMenuItem itemText="Edit" onClick={() => handleEditContext(context)} />
        <OverflowMenuItem itemText="Duplicate" onClick={() => console.log('Duplicate', context.id)} />
        <OverflowMenuItem
          itemText="Delete"
          isDelete
          onClick={() => handleDeleteContexts([context.id])}
        />
      </OverflowMenu>
    ),
  }));

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <Heading marginBottom={0}>Contexts</Heading>
        <Button renderIcon={Add} kind="primary" onClick={handleCreateContext}>
          Create Context
        </Button>
      </div>

      <DataTable
        rows={rows}
        headers={headers}
        radio={false}
        onSelectionChange={(data) => setSelectedRows(data.selectedRows.map(row => row.id))}
      >
        {({
          rows,
          headers,
          getHeaderProps,
          getRowProps,
          getSelectionProps,
          getToolbarProps,
          getBatchActionProps,
          onInputChange,
          selectedRows: tableSelectedRows,
          getTableProps,
          getTableContainerProps,
        }) => (
          <TableContainer
            title="Context Management"
            description="Manage your AI conversation contexts and knowledge base"
            {...getTableContainerProps()}
          >
            <TableToolbar {...getToolbarProps()}>
              <TableBatchActions {...getBatchActionProps()}>
                <TableBatchAction
                  tabIndex={getBatchActionProps().shouldShowBatchActions ? 0 : -1}
                  renderIcon={Download}
                  onClick={() => console.log('Export selected')}
                >
                  Export
                </TableBatchAction>
                <TableBatchAction
                  tabIndex={getBatchActionProps().shouldShowBatchActions ? 0 : -1}
                  renderIcon={TrashCan}
                  onClick={() => handleDeleteContexts(selectedRows)}
                >
                  Delete
                </TableBatchAction>
              </TableBatchActions>
              <TableToolbarContent>
                <TableToolbarSearch
                  defaultValue={searchValue}
                  onChange={(e) => {
                    onInputChange(e);
                    setSearchValue(e.target.value);
                  }}
                  placeholder="Search contexts..."
                />
                <TableToolbarMenu renderIcon={Filter}>
                  <TableToolbarAction onClick={() => console.log('Filter by type')}>
                    Filter by Type
                  </TableToolbarAction>
                  <TableToolbarAction onClick={() => console.log('Filter by status')}>
                    Filter by Status
                  </TableToolbarAction>
                </TableToolbarMenu>
                <TableToolbarAction
                  renderIcon={Settings}
                  onClick={() => console.log('Settings')}
                />
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  <TableSelectAll {...getSelectionProps()} />
                  {headers.map((header) => (
                    <TableHeader {...getHeaderProps({ header })}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow {...getRowProps({ row })}>
                    <TableSelectRow {...getSelectionProps({ row })} />
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>

      <Pagination
        backwardText="Previous page"
        forwardText="Next page"
        itemsPerPageText="Items per page:"
        page={currentPage}
        pageNumberText="Page Number"
        pageSize={pageSize}
        pageSizes={[10, 20, 30, 40, 50]}
        totalItems={contexts.length}
        onChange={({ page, pageSize }) => {
          setCurrentPage(page);
          setPageSize(pageSize);
        }}
      />

      {/* Create Context Modal */}
      <Modal
        open={createModalOpen}
        onRequestClose={() => setCreateModalOpen(false)}
        modalHeading="Create New Context"
        primaryButtonText="Create"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleSaveContext}
      >
        <FormGroup legendText="">
          <TextInput
            id="title"
            labelText="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter context title"
          />
          <Dropdown
            id="type"
            titleText="Type"
            items={contextTypes}
            selectedItem={contextTypes.find(t => t.id === formData.type)}
            onChange={({ selectedItem }) => 
              setFormData({ ...formData, type: selectedItem?.id || 'general' })
            }
          />
          <TextArea
            id="content"
            labelText="Content"
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="Enter context content"
            rows={6}
          />
          <TextInput
            id="tags"
            labelText="Tags (comma-separated)"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="tag1, tag2, tag3"
          />
        </FormGroup>
      </Modal>

      {/* Edit Context Modal */}
      <Modal
        open={editModalOpen}
        onRequestClose={() => setEditModalOpen(false)}
        modalHeading="Edit Context"
        primaryButtonText="Save"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleSaveContext}
      >
        <FormGroup legendText="">
          <TextInput
            id="edit-title"
            labelText="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter context title"
          />
          <Dropdown
            id="edit-type"
            titleText="Type"
            items={contextTypes}
            selectedItem={contextTypes.find(t => t.id === formData.type)}
            onChange={({ selectedItem }) => 
              setFormData({ ...formData, type: selectedItem?.id || 'general' })
            }
          />
          <TextArea
            id="edit-content"
            labelText="Content"
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="Enter context content"
            rows={6}
          />
          <TextInput
            id="edit-tags"
            labelText="Tags (comma-separated)"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="tag1, tag2, tag3"
          />
        </FormGroup>
      </Modal>
    </div>
  );
};