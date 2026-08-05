import { useEffect, useRef, useState } from 'react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

const PROJECT_LABELS = { fos:'FOS', atm_mitra:'ATM Mitra', csp_mitra:'CSP Mitra', seva_sarathi:'Seva Sarathi', collections:'Collections' }

export default function PaymentUpload() {
  const [tab, setTab] = useState('manual') // 'manual' | 'excel'

// Manual Payment

const [batches, setBatches] = useState([])
const [vendors, setVendors] = useState([])

const [selected, setSelected] = useState(new Set())

const [loading, setLoading] = useState(false)
const [saving, setSaving] = useState(false)

const [utr, setUtr] = useState('')
const [payDate, setPayDate] = useState('')

const [startDate, setStartDate] = useState(null)
const [endDate, setEndDate] = useState(null)

const [filters, setFilters] = useState({
    vendor: '',
    project: '',
    nature: '',
    paymentStatus: 'pending',
    dateFrom: '',
    dateTo: ''
})

// Excel Import
const fileRef = useRef()
const [uploading, setUploading] = useState(false)
const [preview, setPreview] = useState(null)
const [confirming, setConfirming] = useState(false)

useEffect(() => {

    if (tab === 'manual') {

        loadFilters()
        loadBatches()

    }

}, [tab])

useEffect(() => {
    if (tab === 'manual') {
        loadBatches()
    }
}, [filters])

async function loadBatches() {

    setLoading(true)
    try {

        const r = await api.get('/api/finance/invoices/worklist',
            {
                params: {
                    mode: 'payment',
                    paymentStatus: filters.paymentStatus,
                    hrPartnerId: filters.vendor || undefined,
                    project: filters.project || undefined,
                    nature: filters.nature || undefined,
                    dateFrom: filters.dateFrom || undefined,
                    dateTo: filters.dateTo || undefined
                }
            }
        )

        const data = r.data.batches ?? []
setBatches(data)
    }

    catch {
        toast.error('Failed to load batches')
    }
    finally {
        setLoading(false)
    }
}

async function loadFilters() {

    try {

        const r = await api.get(
            '/api/finance/payment-filters'
        )

        setVendors(r.data.vendors ?? [])

    }

    catch {

        toast.error('Failed to load vendors')

    }

}

function toggleAll() {

    const pendingIds = batches
        .filter(batch => batch.paymentStatus === 'pending')
        .map(batch => batch.id)

    if (
        selected.size === pendingIds.length &&
        pendingIds.length > 0
    ) {

        setSelected(new Set())

    }

    else {

        setSelected(new Set(pendingIds))

    }

}

function toggleOne(batch) {

    if (batch.paymentStatus === 'paid')
        return

    setSelected(prev => {

        const next = new Set(prev)

        if (next.has(batch.id))
            next.delete(batch.id)

        else
            next.add(batch.id)

        return next

    })

}

async function handleBulkPayment() {

    if (selected.size === 0)
        return toast.error('Select at least one batch')

    if (!utr.trim())
        return toast.error('UTR Number is required')

    if (!payDate)
        return toast.error('Payment Date is required')

    setSaving(true)

    try {
        const r = await api.post('/api/finance/batches/bulk-payment',
            {
                batchIds: [...selected],
                utrNumber: utr,
                paymentDate: payDate
            }

        )

        toast.success(`${r.data.success.length} batch(s) updated`)

        if (r.data.failed.length) {
            toast.error(`${r.data.failed.length} batch(s) failed`
            )
        }
        setSelected(new Set())
        setUtr('')
        setPayDate('')
        loadBatches()

    }

    catch (err) {
        toast.error(err.response?.data?.message ||'Payment update failed')
    }

    finally {
        setSaving(false)
    }

}

  async function downloadTemplate() {
    try {
      const r = await api.get('/api/finance/payment-template', { responseType: 'blob' })
      const url = URL.createObjectURL(r.data)
      const a = document.createElement('a'); a.href = url; a.download = `payment_template_${Date.now()}.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Failed to download template') }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setPreview(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const r = await api.post('/api/finance/payment-import/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setPreview(r.data)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to parse file')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleConfirm() {
    if (!preview?.matched?.length) return
    setConfirming(true)
    try {
      const r = await api.post('/api/finance/payment-import/confirm', { rows: preview.matched })
      toast.success(`${r.data.success?.length ?? 0} payment(s) confirmed`)
      if (r.data.failed?.length > 0) toast.error(`${r.data.failed.length} failed`)
      setPreview(null)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Confirm failed')
    } finally { setConfirming(false) }
  }

  return (
    <div>
      <div className="page-header">
        <div><h2>Mark Payment</h2><p>Update UTR and payment date for cleared invoices</p></div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:16 }}>
        <button className={`btn btn-sm ${tab==='manual' ? 'btn-primary' : ''}`} onClick={() => setTab('manual')}>Manual Entry</button>
        <button className={`btn btn-sm ${tab==='excel'  ? 'btn-primary' : ''}`} onClick={() => setTab('excel')}>Excel Import</button>
      </div>

      {/* ── Manual Tab ── */}
     {tab === 'manual' && (

<>
    {/* Filters */}

    <div className="card" style={{ marginBottom:16 }}>

        <div
            style={{
                display:'grid',
                gridTemplateColumns:'repeat(5,1fr)',
                gap:12
            }}
        >

            <div className="form-group" style={{marginBottom:0}}>
                <label>Vendor</label>

                <select
                    value={filters.vendor}
                    onChange={e=>setFilters({
                        ...filters,
                        vendor:e.target.value
                    })}
                >

                    <option value="">All Vendors</option>

                    {
                        vendors.map(v=>(
                            <option
                                key={v.id}
                                value={v.id}
                            >
                                {v.name}
                            </option>
                        ))
                    }

                </select>

            </div>

            <div className="form-group" style={{marginBottom:0}}>

                <label>Project</label>

                <select
                    value={filters.project}
                    onChange={e=>setFilters({
                        ...filters,
                        project:e.target.value
                    })}
                >

                    <option value="">All Projects</option>

                    {
                        Object.entries(PROJECT_LABELS).map(([key,val])=>

                            <option
                                key={key}
                                value={key}
                            >
                                {val}
                            </option>

                        )
                    }

                </select>

            </div>

            <div className="form-group" style={{ marginBottom:0 }}>

    <label>Nature</label>

    <select
        value={filters.nature}
        onChange={e =>
            setFilters({
                ...filters,
                nature: e.target.value
            })
        }
    >

        <option value="">All Nature</option>

        <option value="salary">Salary</option>
        <option value="reimbursement">Reimbursement</option>
        <option value="sourcing">Sourcing</option>
        <option value="bgv">BGV</option>
        <option value="fnf">FnF</option>

    </select>

</div>

            <div className="form-group" style={{marginBottom:0}}>

                <label>Payment Status</label>

                <select
                    value={filters.paymentStatus}
                    onChange={e=>setFilters({
                        ...filters,
                        paymentStatus:e.target.value
                    })}
                >

                    <option value="pending">Pending</option>

                    <option value="paid">Paid</option>

                    <option value="all">All</option>

                </select>

            </div>

             <div className="form-group" style={{ marginBottom: 0 }}>
             <label>Date Range</label>
           
             <DatePicker
               selectsRange
               startDate={startDate}
               endDate={endDate}
              onChange={(update) => {

    const [start, end] = update

    setStartDate(start)
    setEndDate(end)

    setFilters(prev => ({
        ...prev,
        dateFrom: start
            ? start.toISOString().split('T')[0]
            : '',
        dateTo: end
            ? end.toISOString().split('T')[0]
            : ''
    }))

}}
               isClearable
               placeholderText="Select date range"
               dateFormat="dd/MM/yyyy"
             />
           </div>

        </div>

    </div>

    {/* Bulk Payment */}

    {
        filters.paymentStatus !== 'paid' &&

        <div className="card" style={{marginBottom:16}}>

            <div
                style={{
                    display:'grid',
                    gridTemplateColumns:'1fr 1fr auto',
                    gap:12,
                    alignItems:'end'
                }}
            >

                <div className="form-group" style={{marginBottom:0}}>

                    <label>UTR Number</label>

                    <input
                        value={utr}
                        onChange={e=>setUtr(e.target.value)}
                    />

                </div>

                <div className="form-group" style={{marginBottom:0}}>

                    <label>Payment Date</label>

                    <input
                        type="date"
                        value={payDate}
                        onChange={e=>setPayDate(e.target.value)}
                    />

                </div>

                <button
                    className="btn btn-primary"
                    disabled={
                        saving ||
                        selected.size===0
                    }
                    onClick={handleBulkPayment}
                >
                    {
                        saving
                        ? 'Processing...'
                        : `Mark ${selected.size} Batch${selected.size===1?'':'es'} Paid`
                    }
                </button>

            </div>

        </div>

    }

    {/* Table */}

    <div className="card" style={{padding:0}}>

        <div className="table-wrap">

            <table>

                <thead>

                <tr>

                    <th width={45}>

                        {
                            filters.paymentStatus !== 'paid' &&

                            <input
                                type="checkbox"
                                onChange={toggleAll}
                                checked={
                                    batches.filter(
                                        b=>b.paymentStatus==='pending'
                                    ).length>0 &&
                                    selected.size===batches.filter(
                                        b=>b.paymentStatus==='pending'
                                    ).length
                                }
                            />

                        }

                    </th>

                    <th>Batch</th>

                    <th>Vendor</th>

                    <th>Project</th>

                    <th>Nature</th>

                    <th>Total</th>

                    <th>Paid</th>

                    <th>Status</th>

                    <th>Uploaded</th>

                </tr>

                </thead>

                <tbody>

                {
                    loading &&

                    <tr>

                        <td
                            colSpan={9}
                            style={{
                                padding:40,
                                textAlign:'center'
                            }}
                        >
                            Loading...
                        </td>

                    </tr>

                }

                {
                    !loading &&
                    batches.length===0 &&

                    <tr>

                        <td
                            colSpan={9}
                            style={{
                                padding:40,
                                textAlign:'center'
                            }}
                        >
                            No batches found
                        </td>

                    </tr>

                }

                {
                    batches.map(batch=>(

                        <tr
                            key={batch.id}
                            className={
                                batch.paymentStatus==='pending'
                                ? 'clickable'
                                : ''
                            }
                            onClick={()=>toggleOne(batch)}
                        >

                            <td
                                onClick={e=>e.stopPropagation()}
                            >

                                {
                                    batch.paymentStatus==='pending'

                                    ?

                                    <input
                                        type="checkbox"
                                        checked={selected.has(batch.id)}
                                        onChange={()=>toggleOne(batch)}
                                    />

                                    :

                                    <span
                                        style={{
                                            color:'green',
                                            fontWeight:700
                                        }}
                                    >
                                        ✓
                                    </span>

                                }

                            </td>

                            <td
                                style={{
                                    fontFamily:'monospace',
                                    fontSize:12
                                }}
                            >
                                {batch.batchNumber}
                            </td>

                            <td>{batch.hrPartner.name}</td>

                            <td>
                                {PROJECT_LABELS[batch.project]}
                            </td>

                            <td style={{textTransform:'capitalize'}}>
                                {batch.nature}
                            </td>

                            <td>{batch.total}</td>

                            <td>{batch.paid}</td>

                            <td>

                                <span
                                    className={
                                        batch.paymentStatus==='paid'
                                        ? 'status-paid'
                                        : 'status-pending'
                                    }
                                >
                                    {
                                        batch.paymentStatus==='paid'
                                        ? 'Paid'
                                        : 'Pending'
                                    }
                                </span>

                            </td>

                            <td>

                                {
                                    new Date(
                                        batch.createdAt
                                    ).toLocaleDateString('en-IN')
                                }

                            </td>

                        </tr>

                    ))
                }

                </tbody>

            </table>

        </div>

    </div>

</>

)}

      {/* ── Excel Import Tab ── */}
      {tab === 'excel' && (
        <>
          <div className="card" style={{ marginBottom:14 }}>
            <h4 style={{ marginTop:0, marginBottom:12 }}>Step 1 — Download Template</h4>
            <p style={{ fontSize:13, color:'#555', marginBottom:12 }}>Download a pre-filled Excel with all cleared & unpaid invoices. Fill in UTR Number and Payment Date columns, then upload below.</p>
            <button className="btn btn-primary" onClick={downloadTemplate}>⬇ Download Payment Template</button>
          </div>

          <div className="card" style={{ marginBottom:14 }}>
            <h4 style={{ marginTop:0, marginBottom:12 }}>Step 2 — Upload Filled Template</h4>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} disabled={uploading} />
            {uploading && <p style={{ color:'#999', fontSize:13, marginTop:8 }}>Parsing file...</p>}
          </div>

          {preview && (
            <>
              {/* Errors */}
              {preview.errors?.length > 0 && (
                <div className="card" style={{ marginBottom:14, borderLeft:'4px solid #cb2431' }}>
                  <h4 style={{ marginTop:0, color:'#cb2431' }}>⚠ {preview.errors.length} row{preview.errors.length > 1 ? 's' : ''} with errors (will be skipped)</h4>
                  {preview.errors.map((e, i) => (
                    <div key={i} style={{ fontSize:12, marginBottom:4 }}>
                      Row {e.row} — <strong>{e.invoiceNumber}</strong>: {e.reason}
                    </div>
                  ))}
                </div>
              )}

              {/* Matched */}
              <div className="card" style={{ padding:0, marginBottom:14 }}>
                <div style={{ padding:'12px 16px', borderBottom:'1px solid #f0f0f0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <h4 style={{ margin:0 }}>Step 3 — Confirm {preview.matched.length} Payment{preview.matched.length !== 1 ? 's' : ''}</h4>
                  <button className="btn btn-success" onClick={handleConfirm} disabled={confirming || preview.matched.length === 0}>
                    {confirming ? 'Confirming...' : `Confirm ${preview.matched.length} Payment${preview.matched.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice No.</th>
                        <th>HR Partner</th>
                        <th>Value</th>
                        <th>UTR Number</th>
                        <th>Payment Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.matched.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign:'center', padding:24, color:'#999' }}>No valid rows to import</td></tr>
                      )}
                      {preview.matched.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontFamily:'monospace', fontSize:12 }}>{r.invoiceNumber}</td>
                          <td>{r.hrPartner}</td>
                          <td style={{ fontFamily:'monospace', fontSize:12 }}>{r.invoiceValue != null ? `₹${Number(r.invoiceValue).toLocaleString('en-IN')}` : '—'}</td>
                          <td style={{ fontFamily:'monospace', fontSize:12 }}>{r.utrNumber}</td>
                          <td style={{ fontSize:12 }}>{r.paymentDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
