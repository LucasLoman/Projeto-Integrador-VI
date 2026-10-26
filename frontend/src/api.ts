import axios from 'axios'
export const api=axios.create({baseURL:import.meta.env.VITE_API_URL || 'http://localhost:8000/api'})
api.interceptors.request.use(config=>{const token=localStorage.getItem('access'); if(token) config.headers.Authorization=`Bearer ${token}`; return config})
api.interceptors.response.use(r=>r,async err=>{if(err.response?.status===401 && localStorage.getItem('refresh')){try{const r=await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/auth/token/refresh/`,{refresh:localStorage.getItem('refresh')}); localStorage.setItem('access',r.data.access); err.config.headers.Authorization=`Bearer ${r.data.access}`; return axios(err.config)}catch{localStorage.clear()}} return Promise.reject(err)})
