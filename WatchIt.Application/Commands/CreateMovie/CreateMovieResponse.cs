namespace WatchIt.Application.Commands.CreateMovie;

using WatchIt.Application.Common;
using WatchIt.Domain.Models;

public class CreateMovieResponse : IMapFrom<Movie>
{
    public int Id { get; set; }
}

