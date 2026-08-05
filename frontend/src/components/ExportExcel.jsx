import { useEffect, useState } from 'react'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import './ExportExcel.css'

import api from '../lib/api'
import toast from 'react-hot-toast'

const PROJECTS = {
    fos: 'FOS',
    atm_mitra: 'ATM Mitra',
    csp_mitra: 'CSP Mitra',
    seva_sarathi: 'Seva Sarathi',
    collections: 'Collections'
}

const NATURES = {
    salary: 'Salary',
    reimbursement: 'Reimbursement',
    sourcing: 'Sourcing',
    bgv: 'BGV',
    fnf: 'FnF'
}

const STAGES = [
    'uploaded',
    'extracted',
    'hr_maker_verified',
    'hr_checker_reviewed',
    'hr_approved',
    'compliance_verified',
    'finance_maker_verified',
    'finance_cleared',
    'paid',
    'rejected'
]

export default function ExportExcel() {

    const [open, setOpen] = useState(false)
    const [vendors, setVendors] = useState([])
    const [loading, setLoading] = useState(false)
    const [startDate, setStartDate] = useState(null)
    const [endDate, setEndDate] = useState(null)
    const [filters, setFilters] = useState({
        hrPartnerId: '',
        project: '',
        nature: '',
        currentStage: '',
        documentType: 'all'
    })

    useEffect(() => {
        if (open) {
            // eslint-disable-next-line react-hooks/immutability
            loadVendors()
        }
    }, [open])

    async function loadVendors() {
        try {
            const r = await api.get('/api/export/filters')
            setVendors(r.data.hrPartners ?? [])
        }

        catch {
            toast.error('Failed to load filters')
        }
    }

    function updateFilter(key, value) {

        setFilters(prev => ({

            ...prev,

            [key]: value

        }))

    }

    async function downloadExcel() {

        setLoading(true)

        try {

            const params = {

                ...filters

            }

            if (startDate)
                params.dateFrom =
                    startDate
                        .toISOString()
                        .slice(0,10)

            if (endDate)
                params.dateTo =
                    endDate
                        .toISOString()
                        .slice(0,10)

            const response =
                await api.get(

                    '/api/export/excel',

                    {

                        params,

                        responseType:'blob'

                    }

                )

            const url =
                window.URL.createObjectURL(
                    new Blob([response.data])
                )

            const link =
                document.createElement('a')

            link.href = url

            link.download =
                `Invoice_Export_${Date.now()}.xlsx`

            link.click()

            window.URL.revokeObjectURL(url)

            setOpen(false)

        }

        catch {

            toast.error(
                'Failed to export excel'
            )

        }

        finally {

            setLoading(false)

        }

    }

    return (

<>

<button
    className="btn btn-primary"
    onClick={() => setOpen(true)}
>
    Download Excel
</button>

{
    open &&

    <div className="export-overlay">

        <div className="export-modal">

            <div className="export-header">

                <h3>
                    Export Excel
                </h3>

                <button

                    className="close-btn"

                    onClick={() => setOpen(false)}

                >
                    ×
                </button>

            </div>

            <div className="export-body">

                <div className="form-group">

                    <label>
                        HR Partner
                    </label>

                    <select

                        value={filters.hrPartnerId}

                        onChange={e =>

                            updateFilter(
                                'hrPartnerId',
                                e.target.value
                            )

                        }

                    >

                        <option value="">
                            All HR Partners
                        </option>

                        {

                            vendors.map(v => (

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

                <div className="form-group">

                    <label>

                        Project

                    </label>

                    <select

                        value={filters.project}

                        onChange={e =>

                            updateFilter(
                                'project',
                                e.target.value
                            )

                        }

                    >

                        <option value="">
                            All Projects
                        </option>

                        {

                            Object.entries(PROJECTS)

                            .map(([key,val]) => (

                                <option

                                    key={key}

                                    value={key}

                                >

                                    {val}

                                </option>

                            ))

                        }

                    </select>

                </div>

                <div className="form-group">

                    <label>

                        Nature

                    </label>

                    <select

                        value={filters.nature}

                        onChange={e =>

                            updateFilter(
                                'nature',
                                e.target.value
                            )

                        }

                    >

                        <option value="">
                            All Nature

                        </option>

                        {

                            Object.entries(NATURES)

                            .map(([key,val]) => (

                                <option

                                    key={key}

                                    value={key}

                                >

                                    {val}

                                </option>

                            ))

                        }

                    </select>

                </div>

                <div className="form-group">

                    <label>

                        Current Stage

                    </label>

                    <select

                        value={filters.currentStage}

                        onChange={e =>

                            updateFilter(
                                'currentStage',
                                e.target.value
                            )

                        }

                    >

                        <option value="">
                            All Stages
                        </option>

                        {

                            STAGES.map(stage => (

                                <option

                                    key={stage}

                                    value={stage}

                                >

                                    {stage}

                                </option>

                            ))

                        }

                    </select>

                </div>

                <div className="form-group">

                    <label>

                        Document Type

                    </label>

                    <select

                        value={filters.documentType}

                        onChange={e =>

                            updateFilter(
                                'documentType',
                                e.target.value
                            )

                        }

                    >

                        <option value="all">

                            All

                        </option>

                        <option value="invoice">

                            Invoice

                        </option>

                        <option value="credit_note">

                            Credit Note

                        </option>

                    </select>

                </div>

                <div className="form-group">

                    <label>

                        Date Range

                    </label>

                    <DatePicker

                        selectsRange

                        startDate={startDate}

                        endDate={endDate}

                        onChange={(dates)=>{

                            const [start,end]=dates

                            setStartDate(start)

                            setEndDate(end)

                        }}

                        isClearable

                        placeholderText="Select date range"

                        dateFormat="dd/MM/yyyy"

                    />

                </div>

            </div>

            <div className="export-footer">

                <button

                    className="btn btn-secondary"

                    onClick={() => setOpen(false)}

                >

                    Cancel

                </button>

                <button

                    className="btn btn-primary"

                    disabled={loading}

                    onClick={downloadExcel}

                >

                    {

                        loading

                        ?

                        'Preparing...'

                        :

                        'Download Excel'

                    }

                </button>

            </div>

        </div>

    </div>

}

</>

)

}