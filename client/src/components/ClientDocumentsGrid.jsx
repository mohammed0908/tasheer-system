import { FileText, Folder, Image } from 'lucide-react';

const formatDocumentType = (type) => {
  if (!type) return 'Document';
  return type
    .replace(/([A-Z])/g, ' $1')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
    .trim();
};

const isImageDocument = (filePath) => /\.(jpg|jpeg|png|webp)$/i.test(filePath || '');

const getUploaderLabel = (role) => {
  if (role === 'client') return 'Uploaded by Client';
  if (role === 'admin') return 'Uploaded by Admin';
  return 'Uploaded by Staff';
};

const ClientDocumentsGrid = ({ documents, isLoading }) => (
  <section>
    <div className="mb-4 flex items-center gap-2">
      <div className="rounded-lg bg-blue-50 p-2 text-agency-blue">
        <Folder size={18} />
      </div>
      <h3 className="text-base font-bold text-gray-900">Uploaded Documents</h3>
    </div>

    {isLoading ? (
      <div className="rounded-lg border border-gray-100 bg-white p-5 text-sm font-medium text-gray-500 shadow-sm">
        Loading documents...
      </div>
    ) : documents?.length === 0 ? (
      <div className="rounded-lg border border-gray-100 bg-white p-5 text-sm font-medium text-gray-500 shadow-sm">
        No documents uploaded yet.
      </div>
    ) : (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {documents?.map((doc) => {
          const Icon = isImageDocument(doc.file_path) ? Image : FileText;
          return (
            <div key={doc.id} className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-gray-50 p-2 text-agency-blue">
                  <Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">{formatDocumentType(doc.document_type)}</p>
                  <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-agency-blue">
                    {getUploaderLabel(doc.uploaded_by_role)}
                  </span>
                </div>
              </div>
              <a
                href={doc.file_path}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100"
              >
                View/Download
              </a>
            </div>
          );
        })}
      </div>
    )}
  </section>
);

export default ClientDocumentsGrid;
