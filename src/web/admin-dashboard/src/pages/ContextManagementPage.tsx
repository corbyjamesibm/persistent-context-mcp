import React, { useState, useMemo } from 'react';
import {
  Grid,
  Column,
  Tile,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Button,
  Tag,
  Dropdown,
  Modal,
  TextInput,
  TextArea,
  MultiSelect,
  Pagination,
  OverflowMenu,
  OverflowMenuItem,
  InlineNotification,
} from '@carbon/react';
import {
  Folder,
  Add,
  Edit,
  TrashCan,
  Search,
  Filter,
  Download,
  Upload,
} from '@carbon/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useNotification } from '../hooks/useNotification';

interface Context {
  id: string;
  title: string;
  content: string;
  type: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  author: string;
  sessionId: string;
  size: number;
}

interface ContextFilters {
  search: string;
  type: string;
  tags: string[];
}

export const ContextManagementPage: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState<ContextFilters>({
    search: '',
    type: '',
    tags: [],
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedContext, setSelectedContext] = useState<Context | null>(null);
  const [newContext, setNewContext] = useState({
    title: '',
    content: '',
    type: '',
    tags: [] as string[],
    sessionId: '',
  });

  const { showSuccess, showError } = useNotification();
  const queryClient = useQueryClient();

  // Available context types and tags for filters
  const contextTypes = [
    { id: 'conversation', text: 'Conversation' },
    { id: 'code', text: 'Code' },
    { id: 'documentation', text: 'Documentation' },
    { id: 'analysis', text: 'Analysis' },
    { id: 'meeting', text: 'Meeting' },
  ];

  const availableTags = [
    { id: 'important', text: 'Important' },
    { id: 'urgent', text: 'Urgent' },
    { id: 'review', text: 'Review' },
    { id: 'archived', text: 'Archived' },
    { id: 'public', text: 'Public' },
    { id: 'private', text: 'Private' },
  ];

  const {
    data: contextsData,
    isLoading: contextsLoading,
    error: contextsError,
  } = useQuery({
    queryKey: ['contexts', currentPage, pageSize, filters],
    queryFn: async () => {
      const response = await api.getContexts({
        page: currentPage,
        limit: pageSize,
        search: filters.search || undefined,
        type: filters.type || undefined,
        tags: filters.tags.length > 0 ? filters.tags : undefined,
      });
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (contextData: typeof newContext) => {
      const response = await api.createContext(contextData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contexts'] });
      setIsCreateModalOpen(false);
      setNewContext({ title: '', content: '', type: '', tags: [], sessionId: '' });
      showSuccess('Context Created', 'New context has been created successfully');
    },
    onError: () => {
      showError('Creation Failed', 'Failed to create new context');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Context> }) => {
      const response = await api.updateContext(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contexts'] });
      setIsEditModalOpen(false);
      setSelectedContext(null);
      showSuccess('Context Updated', 'Context has been updated successfully');
    },
    onError: () => {
      showError('Update Failed', 'Failed to update context');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.deleteContext(id);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contexts'] });
      showSuccess('Context Deleted', 'Context has been deleted successfully');
    },
    onError: () => {
      showError('Deletion Failed', 'Failed to delete context');
    },
  });

  const handleCreateContext = () => {
    createMutation.mutate(newContext);
  };

  const handleUpdateContext = () => {
    if (selectedContext) {
      updateMutation.mutate({
        id: selectedContext.id,
        data: {
          title: selectedContext.title,
          content: selectedContext.content,
          type: selectedContext.type,
          tags: selectedContext.tags,
        },
      });
    }
  };

  const handleDeleteContext = (id: string) => {
    if (window.confirm('Are you sure you want to delete this context?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEditContext = (context: Context) => {
    setSelectedContext(context);
    setIsEditModalOpen(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const contextHeaders = [
    { key: 'title', header: 'Title' },
    { key: 'type', header: 'Type' },
    { key: 'tags', header: 'Tags' },
    { key: 'author', header: 'Author' },
    { key: 'size', header: 'Size' },
    { key: 'updatedAt', header: 'Last Updated' },
    { key: 'actions', header: 'Actions' },
  ];

  const contextRows = useMemo(() => {
    return contextsData?.contexts?.map((context: Context) => ({
      id: context.id,
      title: context.title,
      type: <Tag type="outline">{context.type}</Tag>,
      tags: (
        <div className="tags-cell">
          {context.tags.slice(0, 2).map((tag) => (
            <Tag key={tag} size="sm" type="cool-gray">{tag}</Tag>
          ))}
          {context.tags.length > 2 && (
            <Tag size="sm" type="outline">+{context.tags.length - 2}</Tag>
          )}
        </div>
      ),
      author: context.author,
      size: formatFileSize(context.size),
      updatedAt: new Date(context.updatedAt).toLocaleDateString(),
      actions: (
        <OverflowMenu size="sm" flipped>
          <OverflowMenuItem
            itemText="Edit"
            onClick={() => handleEditContext(context)}
          />
          <OverflowMenuItem
            itemText="Duplicate"
            onClick={() => {
              setNewContext({
                title: `${context.title} (Copy)`,
                content: context.content,
                type: context.type,
                tags: context.tags,
                sessionId: context.sessionId,
              });
              setIsCreateModalOpen(true);
            }}
          />
          <OverflowMenuItem
            itemText="Delete"
            hasDivider
            isDelete
            onClick={() => handleDeleteContext(context.id)}
          />
        </OverflowMenu>
      ),
    })) || [];
  }, [contextsData]);

  if (contextsLoading) {
    return <LoadingSpinner size="lg" description="Loading contexts..." />;
  }

  if (contextsError) {
    return (
      <InlineNotification
        kind="error"
        title="Loading Error"
        subtitle="Failed to load contexts"
      />
    );
  }

  return (
    <div className="context-management-page">
      <Grid>
        {/* Header */}
        <Column lg={16} md={8} sm={4} className="page-header">
          <div className="header-content">
            <div className="header-text">
              <h1 className="page-title">
                <Folder size={32} />
                Context Management
              </h1>
              <p className="page-subtitle">
                Manage and organize your persistent context data
              </p>
            </div>
            <div className="header-actions">
              <Button
                kind="secondary"
                renderIcon={Upload}
              >
                Import
              </Button>
              <Button
                kind="secondary"
                renderIcon={Download}
              >
                Export
              </Button>
              <Button
                kind="primary"
                renderIcon={Add}
                onClick={() => setIsCreateModalOpen(true)}
              >
                Create Context
              </Button>
            </div>
          </div>
        </Column>

        {/* Filters */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="filters-tile">
            <div className="filters-content">
              <div className="filter-group">
                <Dropdown
                  id="type-filter"
                  titleText="Filter by Type"
                  items={[{ id: '', text: 'All Types' }, ...contextTypes]}
                  selectedItem={contextTypes.find(t => t.id === filters.type) || { id: '', text: 'All Types' }}
                  onChange={({ selectedItem }) => 
                    setFilters(prev => ({ ...prev, type: selectedItem?.id || '' }))
                  }
                />
              </div>
              <div className="filter-group">
                <MultiSelect
                  id="tags-filter"
                  titleText="Filter by Tags"
                  items={availableTags}
                  initialSelectedItems={availableTags.filter(tag => filters.tags.includes(tag.id))}
                  onChange={({ selectedItems }) =>
                    setFilters(prev => ({ ...prev, tags: selectedItems.map(item => item.id) }))
                  }
                />
              </div>
              <Button
                kind="ghost"
                size="sm"
                onClick={() => setFilters({ search: '', type: '', tags: [] })}
              >
                Clear Filters
              </Button>
            </div>
          </Tile>
        </Column>

        {/* Contexts Table */}
        <Column lg={16} md={8} sm={4}>
          <DataTable
            rows={contextRows}
            headers={contextHeaders}
            size="md"
          >
            {({
              rows,
              headers,
              getHeaderProps,
              getRowProps,
              getTableProps,
              getToolbarProps,
              onInputChange,
              getTableContainerProps,
            }) => (
              <TableContainer
                title="Contexts"
                description="Manage your context data"
                {...getTableContainerProps()}
              >
                <TableToolbar {...getToolbarProps()}>
                  <TableToolbarContent>
                    <TableToolbarSearch
                      persistent
                      onChange={onInputChange}
                      onClear={() => setFilters(prev => ({ ...prev, search: '' }))}
                    />
                    <Button
                      kind="ghost"
                      renderIcon={Filter}
                      hasIconOnly
                      iconDescription="Advanced filters"
                    />
                  </TableToolbarContent>
                </TableToolbar>
                <Table {...getTableProps()}>
                  <TableHead>
                    <TableRow>
                      {headers.map((header) => (
                        <TableHeader {...getHeaderProps({ header })} key={header.key}>
                          {header.header}
                        </TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow {...getRowProps({ row })} key={row.id}>
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
        </Column>

        {/* Pagination */}
        <Column lg={16} md={8} sm={4}>
          <Pagination
            totalItems={contextsData?.total || 0}
            backwardText="Previous page"
            forwardText="Next page"
            pageSize={pageSize}
            pageSizes={[10, 25, 50, 100]}
            itemsPerPageText="Items per page"
            onChange={({ page, pageSize: newPageSize }) => {
              setCurrentPage(page);
              setPageSize(newPageSize);
            }}
          />
        </Column>
      </Grid>

      {/* Create Context Modal */}
      <Modal
        open={isCreateModalOpen}
        onRequestClose={() => setIsCreateModalOpen(false)}
        modalHeading="Create New Context"
        primaryButtonText="Create"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleCreateContext}
        primaryButtonDisabled={createMutation.isPending}
      >
        <div className="modal-content">
          <TextInput
            id="new-title"
            labelText="Title"
            value={newContext.title}
            onChange={(e) => setNewContext(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Enter context title"
            required
          />
          <Dropdown
            id="new-type"
            titleText="Type"
            items={contextTypes}
            selectedItem={contextTypes.find(t => t.id === newContext.type)}
            onChange={({ selectedItem }) =>
              setNewContext(prev => ({ ...prev, type: selectedItem?.id || '' }))
            }
          />
          <MultiSelect
            id="new-tags"
            titleText="Tags"
            items={availableTags}
            initialSelectedItems={availableTags.filter(tag => newContext.tags.includes(tag.id))}
            onChange={({ selectedItems }) =>
              setNewContext(prev => ({ ...prev, tags: selectedItems.map(item => item.id) }))
            }
          />
          <TextInput
            id="new-session-id"
            labelText="Session ID"
            value={newContext.sessionId}
            onChange={(e) => setNewContext(prev => ({ ...prev, sessionId: e.target.value }))}
            placeholder="Enter session ID"
            required
          />
          <TextArea
            id="new-content"
            labelText="Content"
            value={newContext.content}
            onChange={(e) => setNewContext(prev => ({ ...prev, content: e.target.value }))}
            placeholder="Enter context content"
            rows={6}
            required
          />
        </div>
      </Modal>

      {/* Edit Context Modal */}
      <Modal
        open={isEditModalOpen}
        onRequestClose={() => setIsEditModalOpen(false)}
        modalHeading="Edit Context"
        primaryButtonText="Save Changes"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleUpdateContext}
        primaryButtonDisabled={updateMutation.isPending}
      >
        {selectedContext && (
          <div className="modal-content">
            <TextInput
              id="edit-title"
              labelText="Title"
              value={selectedContext.title}
              onChange={(e) => setSelectedContext(prev => prev ? { ...prev, title: e.target.value } : null)}
              placeholder="Enter context title"
              required
            />
            <Dropdown
              id="edit-type"
              titleText="Type"
              items={contextTypes}
              selectedItem={contextTypes.find(t => t.id === selectedContext.type)}
              onChange={({ selectedItem }) =>
                setSelectedContext(prev => prev ? { ...prev, type: selectedItem?.id || '' } : null)
              }
            />
            <MultiSelect
              id="edit-tags"
              titleText="Tags"
              items={availableTags}
              initialSelectedItems={availableTags.filter(tag => selectedContext.tags.includes(tag.id))}
              onChange={({ selectedItems }) =>
                setSelectedContext(prev => prev ? { ...prev, tags: selectedItems.map(item => item.id) } : null)
              }
            />
            <TextArea
              id="edit-content"
              labelText="Content"
              value={selectedContext.content}
              onChange={(e) => setSelectedContext(prev => prev ? { ...prev, content: e.target.value } : null)}
              placeholder="Enter context content"
              rows={6}
              required
            />
          </div>
        )}
      </Modal>

      <style jsx>{`
        .context-management-page {
          padding: var(--cds-spacing-06);
        }

        .page-header {
          margin-bottom: var(--cds-spacing-06);
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--cds-spacing-06);
        }

        .page-title {
          display: flex;
          align-items: center;
          gap: var(--cds-spacing-03);
          font-size: 2rem;
          font-weight: 600;
          margin-bottom: var(--cds-spacing-02);
          color: var(--cds-text-primary);
        }

        .page-subtitle {
          color: var(--cds-text-secondary);
          font-size: 1.125rem;
          margin: 0;
        }

        .header-actions {
          display: flex;
          gap: var(--cds-spacing-03);
        }

        .filters-tile {
          margin-bottom: var(--cds-spacing-05);
          padding: var(--cds-spacing-05);
        }

        .filters-content {
          display: flex;
          align-items: flex-end;
          gap: var(--cds-spacing-05);
        }

        .filter-group {
          min-width: 200px;
        }

        .tags-cell {
          display: flex;
          gap: var(--cds-spacing-02);
          flex-wrap: wrap;
        }

        .modal-content {
          display: flex;
          flex-direction: column;
          gap: var(--cds-spacing-05);
        }

        @media (max-width: 768px) {
          .context-management-page {
            padding: var(--cds-spacing-04);
          }

          .header-content {
            flex-direction: column;
            align-items: stretch;
          }

          .page-title {
            font-size: 1.5rem;
          }

          .filters-content {
            flex-direction: column;
            align-items: stretch;
          }

          .filter-group {
            min-width: auto;
          }
        }
      `}</style>
    </div>
  );
};