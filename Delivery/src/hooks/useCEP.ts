import { useCallback, useState } from 'react';

export interface CEPData {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

export function useCEP() {
  const [cep, setCep] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const formatAddress = (data: CEPData) =>
    [data.logradouro, data.bairro, `${data.localidade} - ${data.uf}`]
      .filter(Boolean)
      .join(', ');

  const lookupCEP = useCallback(async (raw: string): Promise<CEPData | null> => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 8) return null;

    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) throw new Error('Serviço indisponível.');
      const data = await res.json();
      if (data.erro) { setError('CEP não encontrado.'); return null; }
      return data as CEPData;
    } catch {
      setError('Erro ao consultar CEP. Tente novamente ou preencha manualmente.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { cep, setCep, lookupCEP, formatAddress, isLoading, error, setError };
}
