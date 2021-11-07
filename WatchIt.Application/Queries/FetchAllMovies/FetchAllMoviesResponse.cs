namespace WatchIt.Application.Queries.FetchAllMovies;
using System.Collections.Generic;
using WatchIt.Domain.Models;

internal class FetchAllMoviesResponse
{
    public IEnumerable<Movie> Movies { get; set; }
}
