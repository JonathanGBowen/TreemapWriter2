import React, { useState } from 'react';

type JsonValue = string | number | boolean | null | JsonArray | JsonObject;
interface JsonArray extends Array<JsonValue> {}
interface JsonObject { [key: string]: JsonValue }

interface StructuredJsonEditorProps {
  data: any;
  onChange: (newData: any) => void;
  className?: string;
}

const isPrimitive = (val: any) => val === null || typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean';

const ExpandingTextarea = ({ value, onChange, className }: { value: string, onChange: (val: string) => void, className?: string }) => {
  return (
    <div className="relative w-full inline-grid max-w-full pb-1">
      <div className={`whitespace-pre-wrap invisible col-start-1 row-start-1 ${className} min-h-[1.5rem] px-2 py-1 border border-transparent`}>
        {value + " "}
      </div>
      <textarea
        className={`col-start-1 row-start-1 w-full h-full resize-none overflow-hidden bg-slate-900/50 focus:outline-none border border-emerald-400/20 rounded px-2 py-1 ${className}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
};

export const StructuredJsonEditor: React.FC<StructuredJsonEditorProps> = ({ data, onChange, className = '' }) => {

  const JsonNode = ({ name, value, onChangePath, isLast }: { name?: string, value: any, onChangePath: (val: any) => void, isLast: boolean }) => {
    
    const renderKey = () => (
      name !== undefined ? (
        <span className="mr-2 shrink-0">
          <span className="text-cyan-400 font-bold">"{name}"</span>
          <span className="text-slate-400">:</span>
        </span>
      ) : null
    );

    if (value === null) {
      return (
        <div className="flex w-full items-start">
          {renderKey()}
          <span className="text-slate-500 font-bold">null</span>
          {!isLast && <span className="text-slate-400">,</span>}
        </div>
      );
    }

    if (typeof value === 'boolean') {
      return (
        <div className="flex w-full items-start">
          {renderKey()}
          <select 
            value={value ? "true" : "false"}
            onChange={(e) => onChangePath(e.target.value === "true")}
            className="bg-slate-900/50 text-blue-400 font-mono text-xs focus:outline-none border border-blue-400/20 rounded px-1 py-0.5 cursor-pointer appearance-none text-center"
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
          {!isLast && <span className="text-slate-400">,</span>}
        </div>
      );
    }

    if (typeof value === 'number') {
      return (
        <div className="flex w-full items-start">
          {renderKey()}
          <input 
            type="number" 
            value={value}
            onChange={(e) => onChangePath(Number(e.target.value))}
            className="bg-slate-900/50 text-purple-400 font-mono text-xs focus:outline-none border border-purple-400/20 rounded px-2 py-1 w-24 text-right"
          />
          {!isLast && <span className="text-slate-400">,</span>}
        </div>
      );
    }

    if (typeof value === 'string') {
      return (
        <div className="flex w-full items-start">
          {renderKey()}
          <div className="flex flex-1 items-start max-w-full">
            <span className="text-emerald-400 mt-1 mr-0.5 w-[0.5ch]">"</span>
            <div className="flex-1 min-w-0 max-w-full">
               <ExpandingTextarea value={value} onChange={onChangePath} className="text-emerald-400 font-mono text-xs max-w-full break-all" />
            </div>
            <span className="text-emerald-400 mt-1 ml-0.5 w-[0.5ch]">"</span>
            {!isLast && <span className="text-slate-400 mt-1">,</span>}
          </div>
        </div>
      );
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
         return (
           <div className="flex w-full items-start">
             {renderKey()}
             <span className="text-slate-400">[]</span>
             {!isLast && <span className="text-slate-400">,</span>}
           </div>
         );
      }
      return (
        <div className="flex flex-col w-full">
          <div className="flex">
            {renderKey()}
            <span className="text-slate-400">[</span>
          </div>
          <div className="pl-4 sm:pl-6 border-l border-slate-700/50 my-1 flex flex-col gap-1.5 w-full">
            {value.map((item, idx) => (
              <div key={idx} className="flex w-full">
                 <JsonNode 
                    value={item} 
                    isLast={idx === value.length - 1}
                    onChangePath={(newVal) => {
                       const newArr = [...value];
                       newArr[idx] = newVal;
                       onChangePath(newArr);
                    }} 
                 />
              </div>
            ))}
          </div>
          <div className="flex">
             <span className="text-slate-400">]</span>
             {!isLast && <span className="text-slate-400">,</span>}
          </div>
        </div>
      );
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) {
        return (
          <div className="flex w-full items-start">
             {renderKey()}
             <span className="text-slate-400">{`{}`}</span>
             {!isLast && <span className="text-slate-400">,</span>}
          </div>
        );
      }
      return (
        <div className="flex flex-col w-full">
          <div className="flex">
            {renderKey()}
            <span className="text-slate-400">{`{`}</span>
          </div>
          <div className="pl-4 sm:pl-6 border-l border-slate-700/50 my-1 flex flex-col gap-1.5 w-full">
            {keys.map((k, idx) => (
              <div key={k} className="flex w-full">
                 <JsonNode 
                    name={k}
                    value={value[k]} 
                    isLast={idx === keys.length - 1}
                    onChangePath={(newVal) => {
                       onChangePath({ ...value, [k]: newVal });
                    }} 
                 />
              </div>
            ))}
          </div>
          <div className="flex">
             <span className="text-slate-400">{`}`}</span>
             {!isLast && <span className="text-slate-400">,</span>}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`font-mono text-sm ${className} w-full max-w-[80ch] mx-auto`}>
      <JsonNode value={data} isLast={true} onChangePath={onChange} />
    </div>
  );
};
