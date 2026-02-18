"use client";

import { uploadFile } from "./UploadFile";

export function UploadForm(){
    return(
        <form action={uploadFile} className="flex flex-col gap-6">
            <div className="group relative">
                <input 
                    type="file" 
                    name="file" 
                    className="block w-full text-sm text-slate-500
                        file:mr-4 file:py-2.5 file:px-6
                        file:rounded-full file:border-0
                        file:text-sm file:font-bold
                        file:bg-blue-50 file:text-blue-700
                        hover:file:bg-blue-100
                        file:cursor-pointer cursor-pointer
                        transition-all"
                />
            </div>
            
            <button 
                type="submit" 
                className="w-full bg-slate-900 text-white py-3.5 px-4 rounded-xl
                    hover:bg-blue-600 active:scale-[0.98]
                    transition-all duration-200
                    font-bold text-sm shadow-lg shadow-blue-200"
            >
                アップロード
            </button>
        </form>
    );
}