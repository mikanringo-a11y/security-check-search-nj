

import { UploadForm } from "./UploadForm";

export default function UploadPage() {
  return (
   
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 antialiased">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-10 border border-slate-100">
        
        <header className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            csv読み込み
          </h1>
          <div className="h-1 w-12 bg-blue-500 mx-auto mt-3 rounded-full"></div>
          <p className="text-slate-500 mt-4 text-sm leading-relaxed">
            csvファイルを選択してください<br />
            
          </p>
        </header>

        <UploadForm />
        
        
      </div>
    </main>
  );
}